const { Client } = require("pg");
const axios = require("axios");
const fs = require("fs");

const dblogin = require(`${__dirname}/dblogin.json`);

const client = new Client(dblogin);
client.connect();

async function fetchTsunDB() {
  const startTime = new Date();
  console.log(`Fetch Start - ${startTime}`);
  const edges = (
    await axios.get(
      "https://raw.githubusercontent.com/KC3Kai/KC3Kai/develop/src/data/edges.json"
    )
  ).data;
  const ships = (
    await axios.get("https://www.nishikuma.net/ImgKCbuilder/static/START2.json")
  ).data.api_data.api_mst_ship.reduce((p, v) => {
    p[v.api_id] = {
      name: v.api_name,
      stype: v.api_mst_stype,
      sortId: v.api_sort_id,
      soku: v.api_soku
    };
    return p;
  }, {});

  const nodes = (
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
    .map(data =>
      data.nodes.map(node => {
        const edgesFromNode = Object.keys(edges[`World ${data.map}`])
          .filter(edge => {
            const e = edges[`World ${data.map}`][edge];
            return e[1] === node;
          })
          .map(edge => parseInt(edge));
        return { map: data.map, node, edgesFromNode };
      })
    )
    .flat();

  Promise.all(
    nodes.map(async ({ map, node, edgesFromNode }) => {
      const result = {
        map: map,
        node: node
      };

      const data = await client
        .query(
          `SELECT * FROM abnormaldamage WHERE map = $1 AND edgeid = ANY($2) AND debuffed = false ORDER BY id`,
          [map, edgesFromNode]
        )
        .catch(err => {
          console.error(`${new Date()} MAP:${map} ${node} Failed.`);
          console.error(err);
          return null;
        });
      const entries = data.rows;
      result["entries"] = entries.length;
      const idobj = {};

      const counter = entries
        .filter(({ ship, enemy, damageinstance }) => {
          const [minDmg, maxDmg] = damageinstance.expectedDamage;
          const damage = damageinstance.actualDamage;

          return !(
            ship.spAttackType >= 100 ||
            enemy.hp <= 0 ||
            damageinstance.resupplyUsed ||
            !ships[enemy.id] ||
            ships[enemy.id].soku === 0 ||
            ships[enemy.id].name === "PT小鬼群" ||
            (Math.floor(enemy.hp * 0.06) <= damage &&
              damage <= Math.max(Math.floor(enemy.hp * 0.14 - 0.08), 0)) ||
            (minDmg <= damage && damage <= maxDmg)
          );
        })
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
          idobj[ship.id].count = idobj[ship.id].count + 1;
        }).length;

      result["date"] = new Date();
      result["samples"] = counter;
      result["data"] = Object.keys(idobj)
        .filter(key => ships[key])
        .filter(key => idobj[key].max > 1 && idobj[key].min > 1)
        .sort((a, b) => ships[a].sortId - ships[b].sortId)
        .reduce((p, key) => {
          p[key] = {
            min: Math.floor(idobj[key].min * 1000) / 1000,
            max: Math.floor(idobj[key].max * 1000) / 1000,
            count: idobj[key].count
          };
          return p;
        }, {});

      const dir = `${__dirname}/${result.map}`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, 0o775);
      }
      fs.writeFile(
        `${dir}/${result.node}.json`,
        JSON.stringify(result),
        err => {
          if (err) {
            console.error(`${new Date()} MAP:${map} ${node} Failed.`);
            console.error(err);
          }
          fs.chmodSync(`${dir}/${result.node}.json`, 0o664);
          console.log(`${new Date()} MAP:${map} ${node} Complete.`);
          return result;
        }
      );
    })
  ).finally(() => {
    const endTime = new Date();
    console.log(
      `Fetch Complete. (${endTime.getTime() - startTime.getTime()}ms)`
    );
    client.end();
  });
}

fetchTsunDB();
