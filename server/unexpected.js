const { Client } = require("pg");
const axios = require("axios");
const fs = require("fs");

const dblogin = require(`${__dirname}/dblogin.json`);

const client = new Client(dblogin);
client.connect();

async function fetchNodes() {
  const edges = (
    await axios.get(
      "https://raw.githubusercontent.com/KC3Kai/KC3Kai/develop/src/data/edges.json"
    )
  ).data;

  return (
    await Promise.all(
      Object.keys(edges)
        .map(world => world.replace("World ", ""))
        .filter(map => map.replace(/(\d+)-\d+/, "$1") >= 46)
        .map(async map => {
          const mapdata = (
            await axios.get(`http://kc.piro.moe/api/routing/maps/${map}`)
          ).data;

          const nodes = Array.from(
            new Set(
              Object.values(mapdata.route)
                // api_event_id 4=通常戦闘, 5=ボス戦闘
                // api_color_no 4=通常戦闘/気のせいだった, 5=ボス戦闘, 11=夜戦, 12=払暁戦?
                .filter(
                  data =>
                    [4, 5].includes(data[3]) && [4, 5, 11, 12].includes(data[2])
                )
                .map(data => data[1])
            )
          );

          return { map, nodes };
        })
    )
  )
    .map(({ map, nodes }) =>
      nodes.map(node => {
        const edgesFromNode = Object.keys(edges[`World ${map}`])
          .filter(edge => {
            const e = edges[`World ${map}`][edge];
            return e[1] === node;
          })
          .map(edge => parseInt(edge));
        return { map, node, edgesFromNode };
      })
    )
    .flat();
}

function writeFiles(results) {
  return Promise.all(
    results
      .filter(result => result)
      .map(result => {
        const dir = `${__dirname}/${result.map}`;
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, 0o775);
        }
        return new Promise((resolve, reject) => {
          fs.writeFile(
            `${dir}/${result.node}.json`,
            JSON.stringify(result),
            err => {
              if (err) {
                console.error(
                  `${new Date()} MAP:${result.map} ${
                    result.node
                  } Data Writing [Failed].`
                );
                console.error(err);
                return reject(err);
              }
              fs.chmodSync(`${dir}/${result.node}.json`, 0o664);
              console.log(
                `${new Date()} MAP:${result.map} ${
                  result.node
                } Data Writing [Success].`
              );
              return resolve(result);
            }
          );
        });
      })
  );
}

async function fetchShips() {
  return (
    await axios.get("https://www.nishikuma.net/ImgKCbuilder/static/START2.json")
  ).data.api_data.api_mst_ship.reduce(
    (obj, v) => ({
      ...obj,
      [v.api_id]: {
        name: v.api_name,
        stype: v.api_mst_stype,
        sortId: v.api_sort_id,
        soku: v.api_soku
      }
    }),
    {}
  );
}

function datafilter({ ship, enemy }, ships) {
  return ships[ship.id] && ships[enemy.id] && ships[enemy.id].soku > 0;
}

async function fetchTsunDB(map, node, edgesFromNode) {
  return await client
    .query(
      `SELECT *
      FROM abnormaldamage
      WHERE map = $1
      AND edgeid = ANY($2)
      AND debuffed = false
      AND NOT (
        (ship->>'spAttackType')::int >= 100
        OR (enemy->>'hp')::int <= 0
        OR (damageinstance->>'resupplyUsed')::boolean
        OR (enemy->>'id')::int BETWEEN 1637 AND 1640
        OR (round((enemy->>'hp')::int * 0.06, 0) <= (damageinstance->>'actualDamage')::int
          AND (damageinstance->>'actualDamage')::int <= round((enemy->>'hp')::int * 0.14 - 0.08, 0))
      )
      ORDER BY id;`,
      [map, edgesFromNode]
    )
    .then(data => {
      console.log(
        `${new Date()} MAP:${map} ${node} Fetch TsunDB Data [Success].`
      );
      return data;
    })
    .catch(err => {
      console.error(
        `${new Date()} MAP:${map} ${node} Fetch TsunDB Data [Failed].`
      );
      console.error(err);
      return err;
    });
}

async function execute() {
  const startTime = new Date();
  console.log(`Fetch Start - ${startTime}`);
  const ships = await fetchShips();
  const nodes = await fetchNodes();

  return Promise.all(
    nodes.map(async ({ map, node, edgesFromNode }) => {
      const data = await fetchTsunDB(map, node, edgesFromNode);

      if (!data) {
        // データ取得失敗時
        return null;
      }

      const result = {
        map: map,
        node: node
      };

      const entries = data.rows;
      result["entries"] = entries.length;
      const idobj = {};

      const counter = entries
        .filter(entry => datafilter(entry, ships))
        .map(({ ship, enemy, damageinstance }) => {
          idobj[ship.id] = idobj[ship.id] || {
            min: 0,
            max: 999,
            count: 0
          };
          const postcapPower = ship.postcapPower;
          const lowPower =
            damageinstance.actualDamage / ship.rAmmoMod + 0.7 * enemy.armor;
          const highPower = lowPower + Math.floor(0.6 * (enemy.armor - 1));
          const lowMod = lowPower / postcapPower;
          const highMod = highPower / postcapPower;

          idobj[ship.id].min = Math.max(idobj[ship.id].min, lowMod);
          idobj[ship.id].max = Math.min(idobj[ship.id].max, highMod);
          idobj[ship.id].count++;
        }).length;

      result["date"] = new Date();
      result["samples"] = counter;
      result["data"] = Object.keys(idobj)
        .filter(key => idobj[key].max > 1 && idobj[key].min > 1)
        .reduce(
          (obj, key) => ({
            ...obj,
            [key]: {
              min: Math.floor(idobj[key].min * 1000) / 1000,
              max: Math.floor(idobj[key].max * 1000) / 1000,
              count: idobj[key].count
            }
          }),
          {}
        );
      return result;
    })
  )
    .finally(results => {
      console.log(`${new Date()} TsunDB disconnection.`);
      client.end();
      return results;
    })
    .then(writeFiles)
    .finally(() => {
      const endTime = new Date();
      console.log(
        `Fetch Complete. (${Math.floor(
          (endTime.getTime() - startTime.getTime()) / 1000
        )}s)`
      );
    });
}

execute();
