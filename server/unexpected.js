const { Client } = require("pg");
const axios = require("axios");
const fs = require("fs");

const dblogin = require(`${__dirname}/dblogin.json`);

async function fetchNodes() {
  // const edges = (
  //   await axios.get(
  //     "https://raw.githubusercontent.com/KC3Kai/KC3Kai/develop/src/data/edges.json"
  //   )
  // ).data;
  const edges = {
    "World 48-1": {
      "1": ["Start", "A", 90, 6],
      "2": ["A", "B", 90, 6],
      "3": ["B", "C", 91, 6],
      "4": ["C", "D", 4, 4],
      "5": ["C", "E", 90, 6],
      "6": ["E", "F", 4, 4],
      "7": ["D", "G", 4, 4],
      "8": ["G", "H", 4, 4],
      "9": ["H", "I", 4, 4],
      "10": ["G", "J", 4, 4],
      "11": ["H", "K", 90, 6],
      "12": ["K", "L", 6, 9],
      "13": ["L", "M", 5, 5],
      "14": ["I", "K", 90, 6],
      "15": ["J", "K", 90, 6],
      "16": ["F", "N", 4, 4],
      "17": ["F", "O", 90, 6],
      "18": ["N", "P", 90, 6],
      "19": ["R", "Q", 4, 4],
      "20": ["O", "R", 4, 4],
      "21": ["R", "S", 90, 6],
      "22": ["N", "T", 5, 5],
      "23": ["Q", "T", 5, 5]
    },
    "World 48-2": {
      "1": ["Start", "A", 90, 6],
      "2": ["A", "B", 91, 6],
      "3": ["A", "C", 4, 4],
      "4": ["B", "D", 4, 4],
      "5": ["B", "E", 10, 4],
      "6": ["E", "F", 4, 4],
      "7": ["D", "G", 10, 4],
      "8": ["C", "H", 4, 4],
      "9": ["F", "I", 90, 6],
      "10": ["K", "J", 4, 4],
      "11": ["I", "K", 91, 6],
      "12": ["K", "L", 10, 4],
      "13": ["I", "M", 5, 5],
      "14": ["G", "F", 4, 4],
      "15": ["E", "H", 4, 4],
      "16": ["F", "H", 4, 4],
      "17": ["H", "I", 90, 6],
      "18": ["J", "M", 5, 5],
      "19": ["G", "N", 4, 4],
      "20": ["N", "O", 10, 4],
      "21": ["N", "P", 4, 4],
      "22": ["O", "Q", -1, -1],
      "23": ["L", "R", 4, 4],
      "24": ["R", "S", -1, -1],
      "25": ["P", "T", 5, 5],
      "26": ["O", "P", 4, 4],
      "27": ["R", "T", 5, 5]
    },
    "World 48-3": {
      "1": ["C", "A", 4, 4],
      "2": ["A", "B", 10, 4],
      "3": ["D", "C", 10, 4],
      "4": ["Start", "D", 91, 6],
      "5": ["D", "E", 90, 6],
      "6": ["E", "F", 4, 4],
      "7": ["F", "G", 91, 6],
      "8": ["G", "H", 10, 4],
      "9": ["H", "I", 4, 4],
      "10": ["I", "J", 90, 6],
      "11": ["G", "K", 10, 4],
      "12": ["I", "L", 4, 4],
      "13": ["K", "M", 4, 4],
      "14": ["K", "N", 4, 4],
      "16": ["M", "N", 4, 4],
      "17": ["B", "P", 4, 4],
      "18": ["P", "Q", -1, -1],
      "19": ["P", "R", 4, 4],
      "20": ["H", "S", 4, 4],
      "21": ["U", "T", 4, 4],
      "22": ["F", "U", 91, 6],
      "23": ["T", "V", 4, 4],
      "24": ["V", "W", 90, 6],
      "25": ["U", "S", 4, 4],
      "26": ["T", "O", 5, 5],
      "27": ["V", "O", 5, 5]
    },
    "World 48-4": {
      "1": ["B", "A", 10, 4],
      "2": ["C", "B", 4, 4],
      "3": ["Start", "C", 91, 6],
      "4": ["F", "D", 4, 4],
      "5": ["C", "E", 4, 4],
      "6": ["G", "F", 91, 6],
      "7": ["E", "G", 10, 4],
      "8": ["E", "H", 4, 4],
      "9": ["G", "I", -1, -1],
      "10": ["F", "J", 4, 4],
      "11": ["J", "K", 4, 4],
      "12": ["H", "L", 6, 9],
      "13": ["L", "M", 5, 5],
      "14": ["H", "I", 4, 4],
      "15": ["K", "I", 4, 4],
      "16": ["I", "L", 6, 9],
      "17": ["K", "L", -1, -1],
      "18": ["B", "N", 4, 4],
      "19": ["A", "O", 4, 4],
      "20": ["O", "Q", 6, 9],
      "21": ["Q", "P", 90, 6],
      "22": ["Q", "R", 5, 5],
      "23": ["N", "A", 10, 4],
      "24": ["A", "D", 4, 4],
      "25": ["D", "O", 4, 4],
      "26": ["H", "S", 10, 4],
      "27": ["J", "T", 91, 6],
      "28": ["S", "V", 90, 6],
      "29": ["T", "U", 90, 6],
      "30": ["U", "W", 10, 4],
      "31": ["V", "X", 4, 4],
      "32": ["V", "Y", 10, 4],
      "33": ["Z1", "Z", 4, 4],
      "34": ["U", "Z1", 10, 4],
      "35": ["X", "Z2", -1, -1],
      "36": ["X", "Z3", 5, 5],
      "37": ["G", "H", 4, 4],
      "38": ["T", "K", -1, -1],
      "39": ["Z", "W", -1, -1],
      "40": ["W", "X", 4, 4],
      "41": ["Y", "X", 4, 4],
      "42": ["Z", "X", 4, 4]
    },
  };

  return (
    await Promise.all(
      Object.keys(edges)
        .map((world) => world.replace("World ", ""))
        .filter((map) => map.replace(/(\d+)-\d+/, "$1") >= 48)
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
      `SELECT (ship->>'id')::int shipid,
        (enemy->>'id')::int enemyid,
        ((damageinstance->>'actualDamage')::int / (ship->>'rAmmoMod')::real + 0.7 * ((enemy->>'armor')::double precision)) / ((ship->>'postcapPower')::double precision) lowmod,
        (((damageinstance->>'actualDamage')::int + 1) / (ship->>'rAmmoMod')::real + 0.7 * ((enemy->>'armor')::double precision) + 0.6 * FLOOR((enemy->>'armor')::double precision - 1)) / ((ship->>'postcapPower')::double precision) highmod
      FROM abnormaldamage
      WHERE id >= 25112400
      AND map = $1
      AND edgeid = ANY($2)
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
      [map, edgesFromNode]
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
