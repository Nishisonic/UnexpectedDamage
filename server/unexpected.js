const { Client } = require("pg");
const axios = require("axios");
const fs = require("fs");

const dblogin = require(`${__dirname}/dblogin.json`);

const unexpectedIDs = [
  25364618,
  25364621,
  25364623,
  25364629,
  25364630,
  25365998,
  25365999,
  25366001,
  25366005,
  25366008,
  25366009,
  25367430,
  25367431,
  25367433,
  25367442,
  25367443,
  25367445,
  25373313,
  25373315,
  25373318,
  25373322,
  25373324,
  25373325,
  25375321,
  25375324,
  25375332,
  25375333,
  25375338,
  25378998,
  25379001,
  25379009,
  25379909,
  25379915,
  25379919,
  25367444,
  25379006,
  25379910,
];

async function fetchNodes() {
  const edges = (
    await axios.get(
      "https://raw.githubusercontent.com/KC3Kai/KC3Kai/develop/src/data/edges.json"
    )
  ).data;

  return (
    await Promise.all(
      Object.keys(edges)
        .map((world) => world.replace("World ", ""))
        .filter((map) => map.replace(/(\d+)-\d+/, "$1") >= 49)
        .map(async (map) => {
          const mapdata = (
            await axios.get(`http://kc.piro.moe/api/routing/maps/${map}`)
          ).data;

          const nodes = Array.from(
            new Set(
              Object.values(mapdata.route)
                // api_event_id 4=通常戦闘, 5=ボス戦闘
                // api_color_no 4=通常戦闘/気のせいだった, 5=ボス戦闘, 11=夜戦, 12=払暁戦?
                .filter(
                  (data) =>
                    [4, 5].includes(data[3]) && [4, 5, 11, 12].includes(data[2])
                )
                .map((data) => data[1])
            )
          );

          return { map, nodes };
        })
    )
  )
    .map(({ map, nodes }) =>
      nodes.map((node) => {
        const edgesFromNode = Object.keys(edges[`World ${map}`])
          .filter((edge) => {
            const e = edges[`World ${map}`][edge];
            return e[1] === node;
          })
          .map((edge) => parseInt(edge));
        return { map, node, edgesFromNode };
      })
    )
    .flat();
}

function writeFile(result) {
  const dir = `${__dirname}/${result.map}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, 0o775);
  }
  return new Promise((resolve, reject) => {
    fs.writeFile(
      `${dir}/${result.node}.json`,
      JSON.stringify(result),
      (err) => {
        if (err) {
          console.error(
            `${new Date()} MAP:${result.map} ${
              result.node
            } Data Writing [Failed].`
          );
          console.error(err);
          return reject();
        }
        fs.chmodSync(`${dir}/${result.node}.json`, 0o664);
        console.log(
          `${new Date()} MAP:${result.map} ${
            result.node
          } Data Writing [Success].`
        );
        resolve();
      }
    );
  });
}

async function fetchShips() {
  return (
    await axios.get("https://www.nishikuma.net/ImgKCbuilder/static/START2.json")
  ).data.api_data.api_mst_ship.reduce(
    (obj, v) => ({
      ...obj,
      [v.api_id]: {
        name: v.api_name,
        stype: v.api_stype,
        sortId: v.api_sort_id,
        soku: v.api_soku,
      },
    }),
    {}
  );
}

function datafilter({ shipid, enemyid }, ships) {
  return ships[shipid] && ships[enemyid] && ships[enemyid].soku > 0;
}

async function fetchTsunDB(map, node, edgesFromNode) {
  const client = new Client(dblogin);
  client.connect();
  return client
    .query(
      // IDを指定しないと処理が終わらない
      `SELECT id, (ship->>'id')::int shipid,
        (enemy->>'id')::int enemyid,
        ((damageinstance->>'actualDamage')::int / (ship->>'rAmmoMod')::real + 0.7 * ((enemy->>'armor')::double precision)) / ((ship->>'postcapPower')::double precision) lowmod,
        (((damageinstance->>'actualDamage')::int + 1) / (ship->>'rAmmoMod')::real + 0.7 * ((enemy->>'armor')::double precision) + 0.6 * FLOOR((enemy->>'armor')::double precision - 1)) / ((ship->>'postcapPower')::double precision) highmod
      FROM abnormaldamage
      WHERE id >= 32711598
      AND map = $1
      AND edgeid = ANY($2)
      AND NOT (id = ANY($3))
      AND debuffed = false
      AND NOT (
        (ship->>'spAttackType')::int >= 100
        OR (enemy->>'hp')::int <= 0
        OR (damageinstance->>'resupplyUsed')::boolean
        OR (enemy->>'id')::int BETWEEN 1637 AND 1640
        OR (FLOOR((enemy->>'hp')::int * 0.06) <= (damageinstance->>'actualDamage')::int
          AND (damageinstance->>'actualDamage')::int <= FLOOR((enemy->>'hp')::int * 0.14 - 0.08))
      )
      ORDER BY id;`,
      [map, edgesFromNode, unexpectedIDs]
    )
    .then((data) => {
      console.log(
        `${new Date()} MAP:${map} ${node} Fetch TsunDB Data [Success].`
      );
      return data;
    })
    .catch((err) => {
      console.error(
        `${new Date()} MAP:${map} ${node} Fetch TsunDB Data [Failed].`
      );
      console.error(err);
    })
    .finally(() => client.end());
}

async function execute() {
  const startTime = new Date();
  console.log(`Fetch Start - ${startTime}`);
  const [ships, nodes] = await Promise.all([fetchShips(), fetchNodes()]);

  return Promise.all(
    nodes.map(async ({ map, node, edgesFromNode }) => {
      const data = await fetchTsunDB(map, node, edgesFromNode);

      if (!data) {
        // データ取得失敗時
        return null;
      }

      const result = {
        map: map,
        node: node,
      };

      const entries = data.rows;
      result["entries"] = entries.length;
      const idobj = {};

      const counter = entries
        .filter((entry) => datafilter(entry, ships))
        .map(({ shipid, lowmod, highmod }) => {
          idobj[shipid] = idobj[shipid] || {
            min: 0,
            max: 999,
            count: 0,
          };

          idobj[shipid].min = Math.max(idobj[shipid].min, lowmod);
          idobj[shipid].max = Math.min(idobj[shipid].max, highmod);
          idobj[shipid].count++;
        }).length;

      result["date"] = new Date();
      result["samples"] = counter;
      result["data"] = Object.keys(idobj)
        .filter((key) => idobj[key].max > 1 && idobj[key].min > 1)
        .reduce(
          (obj, key) => ({
            ...obj,
            [key]: {
              min: Math.floor(idobj[key].min * 1000) / 1000,
              max: Math.floor(idobj[key].max * 1000) / 1000,
              count: idobj[key].count,
            },
          }),
          {}
        );
      return writeFile(result);
    })
  ).finally(() => {
    const endTime = new Date();
    console.log(
      `Fetch Complete. (${Math.floor(
        (endTime.getTime() - startTime.getTime()) / 1000
      )}s)`
    );
  });
}

execute();
