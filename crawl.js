let token = "从 https://next.bgm.tv/demo/access-token 获取";

let fs = require("fs");
let path = require("path");
let axios = require("axios");
const _7z = require("7zip-min");
let sqlite3 = require("better-sqlite3");
let cliProgress = require("cli-progress");

let sleep = ms => new Promise(r => setTimeout(r, ms));
let toParam = params =>
  Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
let md = (...ps) =>
  ps.map(p => fs.existsSync(p) || fs.mkdirSync(p, { recursive: true }));

let instance = axios.create({
  headers: {
    Authorization: `Bearer ${token}`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
  },
});
let typeDir, cacheDir;
async function getSbjs(type = 2) {
  let host = "https://api.bgm.tv";
  let uri = "/v0/subjects";
  let offset = 0;
  let params = {
    type,
    sort: "rank",
    limit: 100,
    offset: offset * 100,
  };
  let bar = new cliProgress.SingleBar();
  bar.start(99, 0);
  while (1) {
    let cachePath = path.join(cacheDir, offset + ".json");
    if (fs.existsSync(cachePath)) {
      bar.increment();
      offset++;
      continue;
    }
    try {
      params.offset = offset * 100;
      let r = await instance.get(`${host}${uri}?${toParam(params)}`, {
        responseType: "json",
      });
      let j = r.data;
      if (j.data[0].rating.rank == 0) break;
      bar.setTotal(Math.ceil(j.total / 100));
      fs.writeFile(cachePath, JSON.stringify(j), () => {});
      bar.increment();
      offset++;
      await sleep(1000);
    } catch (e) {
      console.log(e.message);
      break;
    }
  }
  bar.stop();
}
function todb(min = 1) {
  function minify(j) {
    j.images = j.images.small.replace(
      "https://lain.bgm.tv/r/200/pic/cover/l/",
      ""
    );
    j.tags = j.tags
      .map(({ name }) => name)
      .filter(
        tag =>
          !tag.match(/(?<!\d)(19\d\d|20[012]\d)(?!\d)/) &&
          !["OVA", "WEB", "TV", "剧场版"].includes(tag)
      );
    j.infobox = j.infobox.reduce((infobox, info) => {
      let { key, value } = info;
      if (["中文名", "话数"].includes(key)) return infobox;
      if (value instanceof Array) value = value.map(obj => obj.v);
      infobox[key] = value;
      return infobox;
    }, {});
    delete j.type;
    delete j.locked;
    delete j.series;
    delete j.volumes;
    delete j.meta_tags;
    j.count = Object.values(j.rating.count);
    delete j.rating.count;
    j = { ...j, ...j.rating, ...j.collection };
    delete j.rating;
    delete j.collection;
    return j;
  }
  let dbpath = path.join(typeDir, "bgm.db");
  if (fs.existsSync(dbpath)) fs.unlinkSync(dbpath);
  let db = sqlite3(dbpath);
  if (!min) db.pragma("journal_mode = WAL");
  let j;
  for (let fn of fs.readdirSync(cacheDir)) {
    if (!fn.endsWith(".json")) continue;
    j = JSON.parse(fs.readFileSync(path.join(cacheDir, fn)));
    break;
  }
  if (min) j = minify(j.data[0]);
  let cols = Object.keys(j);
  db.exec(
    `CREATE TABLE IF NOT EXISTS bgm (${cols.join(
      " INT,"
    )} INT,PRIMARY KEY (id))`
  );
  let stmt = db.prepare(
    `REPLACE INTO bgm VALUES (${cols.map(() => "?").join(",")})`
  );
  db.transaction(() => {
    for (let fn of fs.readdirSync(cacheDir)) {
      if (!fn.endsWith(".json")) continue;
      let f = JSON.parse(fs.readFileSync(path.join(cacheDir, fn)));
      let data = f.data;
      for (let j of data) {
        if (min) j = minify(j);
        if (!j.rank) continue;
        for (let k in j) {
          let v = j[k];
          if (v instanceof Object) j[k] = JSON.stringify(v);
          else if (typeof v === "boolean") j[k] = +v;
        }
        stmt.run(Object.values(j));
      }
    }
  })();
  db.close();
  _7z
    .pack(dbpath, dbpath.replace(".db", ""))
    .then(() =>
      fs.rename(
        dbpath.replace(".db", ".7z"),
        dbpath.replace(".db", "_7z"),
        () => {}
      )
    );
}
function countTags(nsfw = 0) {
  let counter = {};
  for (let fn of fs.readdirSync(cacheDir)) {
    if (!fn.endsWith(".json")) continue;
    let data = JSON.parse(fs.readFileSync(path.join(cacheDir, fn))).data;
    for (let j of data) {
      if (nsfw != j.nsfw) continue;
      for (let { name, count } of j.tags) {
        counter[name] = counter[name] ? counter[name] + count : count;
      }
    }
  }
  let sorted = Object.entries(counter).sort((a, b) => b[1] - a[1]);
  let filterd = sorted.filter(
    ([tag, count]) =>
      !tag.match(/(?<!\d)(19\d\d|20[012]\d)(?!\d)/) &&
      !["OVA", "WEB", "TV", "剧场版"].includes(tag) &&
      count > 1
  );
  fs.writeFileSync(
    path.join(typeDir, (nsfw ? "nsfw" : "") + "tags.json"),
    JSON.stringify(filterd)
  );
}
function countInfoKeys() {
  let counter = {};
  for (let fn of fs.readdirSync(cacheDir)) {
    if (!fn.endsWith(".json")) continue;
    let data = JSON.parse(fs.readFileSync(path.join(cacheDir, fn))).data;
    for (let j of data) {
      for (let { key } of j.infobox)
        counter[key] = counter[key] ? counter[key] + 1 : 1;
    }
  }
  let sorted = Object.entries(counter).sort((a, b) => b[1] - a[1]);
  let filterd = sorted.filter(
    ([key, count]) => !["中文名", "话数"].includes(key) && count > 1
  );
  fs.writeFileSync(
    path.join(typeDir, "infokeys.json"),
    JSON.stringify(filterd)
  );
}
async function run(type) {
  typeDir = path.join(__dirname, type.toString());
  cacheDir = path.join(typeDir, "cache");
  md(cacheDir);
  await getSbjs(type.toString());
  todb();
  countInfoKeys();
  countTags();
  countTags(1);
}
(async () => {
  await run(1);
  await run(2);
  await run(4);
})();
