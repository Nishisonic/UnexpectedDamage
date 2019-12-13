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

  Promise.all(
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

        return Promise.all(
          nodes.map(async node => {
            const result = {
              map: map,
              node: node
            };
            const edgesFromNode = Object.keys(edges[`World ${map}`])
              .filter(edge => {
                const e = edges[`World ${map}`][edge];
                return e[1] === node;
              })
              .map(edge => parseInt(edge));

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
              .filter(entry => {
                const [minDmg, maxDmg] = entry.damageinstance.expectedDamage;
                const damage = entry.damageinstance.actualDamage;

                return !(
                  entry.ship.spAttackType >= 100 ||
                  entry.enemy.hp <= 0 ||
                  entry.damageinstance.resupplyUsed ||
                  ships[entry.enemy.id].soku === 0 ||
                  ships[entry.enemy.id].name === "PT小鬼群" ||
                  (Math.floor(entry.enemy.hp * 0.06) <= damage &&
                    damage <=
                      Math.max(Math.floor(entry.enemy.hp * 0.14 - 0.08), 0)) ||
                  (minDmg <= damage && damage <= maxDmg)
                );
              })
              .map(entry => {
                idobj[entry.ship.id] = idobj[entry.ship.id] || {};
                const postcapPower = entry.ship.postcapPower;
                const lowPower =
                  entry.damageinstance.actualDamage / entry.ship.rAmmoMod +
                  0.7 * entry.enemy.armor;
                const highPower =
                  lowPower + Math.floor(0.6 * (entry.enemy.armor - 1));
                const lowMod = lowPower / postcapPower;
                const highMod = highPower / postcapPower;

                if (
                  !idobj[entry.ship.id].min ||
                  idobj[entry.ship.id].min < lowMod
                ) {
                  idobj[entry.ship.id].min = lowMod;
                  idobj[entry.ship.id].mininfo = JSON.stringify(entry);
                }
                if (
                  !idobj[entry.ship.id].max ||
                  idobj[entry.ship.id].max > highMod
                ) {
                  idobj[entry.ship.id].max = highMod;
                  idobj[entry.ship.id].maxinfo = JSON.stringify(entry);
                }

                idobj[entry.ship.id].min = Math.max(
                  idobj[entry.ship.id].min || 0,
                  lowMod
                );
                idobj[entry.ship.id].max = Math.min(
                  idobj[entry.ship.id].max || 999,
                  highMod
                );
                idobj[entry.ship.id].count =
                  (idobj[entry.ship.id].count || 0) + 1;
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
