let gel = document.getElementById;
gel = gel.bind(document);
let nel = document.createElement;
nel = nel.bind(document);
let del = document.documentElement;
let log = console.log;
let div = nel("div");
function throttle(func, ms = 1000) {
  let timeout;
  let again;
  let con = this;
  let throttled = function () {
    if (timeout) return (again = 1);
    func.apply(con, arguments);
    timeout = setTimeout(() => {
      timeout = null;
      if (again) {
        throttled.apply(con, arguments);
        again = 0;
      }
    }, ms);
  };
  return throttled;
}
function pvtscroll(e, t) {
  t = t || e.target;
  if (
    (e.deltaY < 0 && t.scrollTop <= 0) ||
    (e.deltaY > 0 && t.scrollTop + t.clientHeight >= t.scrollHeight - 1)
  )
    e.preventDefault();
}
class IDB {
  db;
  constructor() {}
  init() {
    return new Promise((res, rej) => {
      let r = indexedDB.open("Database", 1);
      r.onsuccess = e => {
        this.db = e.target.result;
        return res(this);
      };
      r.onerror = e => rej(e.target.errorCode);
      r.onupgradeneeded = e => {
        let db = e.target.result;
        if (!db.objectStoreNames.contains("ObjectStore"))
          db.createObjectStore("ObjectStore", {
            keyPath: "id",
            autoIncrement: true,
          });
      };
    });
  }
  exec(func, o) {
    return new Promise((res, rej) => {
      let t = this.db.transaction(["ObjectStore"], "readwrite");
      let s = t.objectStore("ObjectStore");
      let r = s[func](o);
      r.onsuccess = e => res(e.target.result?.v);
      r.onerror = e => rej(e.target.errorCode);
    });
  }
  getItem(k) {
    return this.exec("get", k);
  }
  setItem(k, v) {
    return this.exec("put", { id: k, v });
  }
  removeItem(k) {
    return this.exec("delete", k);
  }
  clear() {
    return this.exec("clear");
  }
}
navigator.serviceWorker.register("sw.js");

let searchbar = gel("searchbar");
let nsfw = gel("nsfw");
let tagnum = gel("tagnum");
let bgmbox = gel("bgmbox");
let stmt,
  tags,
  nsfwtags,
  infotags,
  infokeys,
  barTags = [];

function initBox() {
  bgmbox.addEventListener("click", e => {
    let t = e.target;
    let tag = t.innerText;
    if (!e.altKey && t.closest(".tags") && t.matches("span")) {
      searchbar.value +=
        (searchbar.value.endsWith(" ") || searchbar.value === "" ? "" : " ") +
        tag +
        " ";
      barTags.push(tag);
      searchbar.oninput();
      searchbar.focus();
    }
    if (t.matches(".thumb")) {
      open("https://bgm.tv/subject/" + t.closest(".bgm").sbj.id, "_blank");
    }
  });
  bgmbox.addEventListener("mouseover", e => {
    let base = e.target.closest(".base");
    if (base && !base.hasDetail) {
      let bgm = e.target.closest(".bgm");
      let sbj = bgm.sbj;
      let $ = bgm.querySelector.bind(bgm);
      let count = JSON.parse(sbj.count);
      let max = Math.max(...count);
      $(".chart").replaceChildren(
        ...count.map((v, i) => {
          $(".val").innerText = v;
          $(".col").style.height = (v / max) * 100 + "%";
          $(".idx").innerText = i;
          return $(".bar").cloneNode(true);
        })
      );
      $(".other").innerText = [
        "想看:" + sbj.wish,
        "在看:" + sbj.doing,
        "看过:" + sbj.collect,
        "搁置:" + sbj.on_hold,
        "抛弃:" + sbj.dropped,
      ].join(" | ");
      base.hasDetail = true;
    }
  });
  window.onresize = loadNext;
  document.onscroll = loadNext;
}
function search() {
  let cols = {
    r: "rank",
    s: "score",
    t: "total",
    e: "eps",
    te: "total_episodes",
    w: "wish",
    o: "on_hold",
    d: "doing",
    c: "collect",
    dr: "dropped",
    y: "CAST(strftime('%m', date) AS INT)",
  };
  let text = searchbar.value.trim();
  let terms = text.split(" ");
  if (!terms) terms = [];
  let ands = [];
  barTags = [];
  function parseTerm(term) {
    term = term
      .replace(/(?<!:)<|(?<!:)>|(?<!:)=/, ":$&")
      .replace("：", ":")
      .replace(/^！/, "!");
    let not = "";
    if (term.startsWith("!")) {
      not = "not ";
      term = term.slice(1);
    }
    if (!term.includes(":")) term += `:${tagnum.value}`;
    let [k, v] = term.split(":");
    if (k === "n")
      return `${not}name||name_cn||json_extract(infobox,'$.别名') like '%${v.replace(
        "=",
        ""
      )}%'`;
    let col = cols[k];
    if (!col) {
      if (infokeys.includes(k))
        return `${not}json_extract(infobox,'$.${k}') like '%${v.replaceAll(
          "=",
          ""
        )}%'`;
      if (not === "") barTags.push(k);
      if (["=", ">", "<"].every(c => !v.startsWith(c))) v = ">=" + v;
      if (
        (not === "" && v.startsWith("<")) ||
        (not !== "" && v.startsWith(">"))
      )
        v += ` or json_extract(tags,'$.${k}')is null`;
      return `${not}json_extract(tags,'$.${k}')${v}`;
    }
    if (["=", ">", "<"].every(c => !v.startsWith(c))) v = "=" + v;
    return `${not}${col}${v}`;
  }
  for (let term of terms) {
    if (!term.includes("|")) term += "|";
    let subterms = term.split("|");
    let ors = [];
    for (let subterm of subterms) {
      if (subterm === "") continue;
      let clause = parseTerm(subterm);
      if (clause) ors.push(clause);
    }
    if (ors.length) ands.push(`(${ors.join(" or ")})`);
  }
  if (!nsfw.indeterminate) ands.push("nsfw=" + +nsfw.checked);
  let platform = gel("platform");
  if (platform.options.length !== platform.selectedOptions.length)
    ands.push(
      `platform in (${[...platform.selectedOptions]
        .map(o => `'${o.value}'`)
        .join(",")})`
    );
  if (gel("startdate").value !== "")
    ands.push(`date>'${gel("startdate").value}'`);
  if (gel("enddate").value !== "") ands.push(`date<'${gel("enddate").value}'`);
  let select = "select * from bgm";
  let where = ands.length ? " where " + ands.join(" and ") : "";
  let order = ` order by ${gel("sortby").value} ${gel("scending").value}`;
  let sql = select + where + order;
  log(sql);
  stmt = db.prepare(sql);
  bgmbox.replaceChildren();
  loadNext();
}
function loadNext() {
  if (del.scrollTop + del.clientHeight > del.scrollHeight - del.clientHeight)
    loadbgms();
}
async function loadbgms() {
  let tpl = gel("bgms").content;
  for (let _ of Array(25)) {
    if (!stmt.step()) return;
    let sbj = stmt.get({});
    let bgm = tpl.cloneNode(true).children[0];
    bgm.sbj = sbj;
    let $ = bgm.querySelector.bind(bgm);
    $(".thumb").src = "https://lain.bgm.tv/r/200/pic/cover/l/" + sbj.images;
    if (sbj.nsfw) $(".thumb").classList.add("nsfw");
    $(".name_cn").innerText = sbj.name_cn || sbj.name;
    sbj.name_cn ? ($(".name").innerText = sbj.name) : $(".name").remove();
    $(".solid").style.width = sbj.score * 10 + "%";
    $(".base").replaceChildren(
      ...[
        sbj.platform,
        sbj.eps +
          (sbj.total_episodes - sbj.eps
            ? "+" + (sbj.total_episodes - sbj.eps)
            : "") +
          "话",
        new Date(sbj.date).toLocaleDateString().slice(2),
        "排" + sbj.rank,
        nel("br"),
        $(".score"),
        sbj.score + "分",
        sbj.total + "评",
      ].flatMap((el, i) => (i > 0 ? [" ", el] : el))
    );
    $(".base").normalize();
    let tagWrap = $(".tags");
    sbj.tags = sbj.tags
      .slice(1, -1)
      .split(",")
      .map(s =>
        s
          .split(":")
          .map((s, i) =>
            i === 0 ? s.slice(1, -1).replaceAll('\\"', '"') : Number(s)
          )
      );
    sbj.tags.forEach(([tag, count]) => {
      if (count < tagnum.value) return;
      let tagEl = nel("span");
      tagEl.innerText = tag;
      if (barTags.includes(tag)) tagEl.classList.add("match");
      tagWrap.append(tagEl);
    });
    bgmbox.append(bgm);
  }
  loadNext();
}
async function initBar() {
  nsfw.indeterminate = true;
  nsfw.onclick = e => e.preventDefault();
  nsfw.onmouseup = () => {
    if (!nsfw.checked && !nsfw.indeterminate) {
      nsfw.indeterminate = true;
    } else if (nsfw.indeterminate) {
      nsfw.indeterminate = false;
      nsfw.checked = true;
    } else nsfw.checked = false;
  };
  tagnum.nextElementSibling.innerText = tagnum.value;
  tagnum.oninput = () => (tagnum.nextElementSibling.innerText = tagnum.value);
  gel("searchbtn").onclick = search;
}
async function initDB() {
  let sqlite3 = await sqlite3InitModule();
  window.sqlite3 = sqlite3;
  let idb = new IDB();
  window.idb = await idb.init();
  let root = await navigator.storage.getDirectory();
  let ab;
  async function getdb() {
    let blob = await (await fetch("bgm_7z")).blob();
    localStorage.setItem("7zsize", blob.size);
    let archive = await Archive.open(blob);
    let files = await archive.extractFiles();
    let file = files["bgm.db"];
    ab = await file.arrayBuffer();
    idb.setItem("bgm.db", ab);
    try {
      let dbfile = await root.getFileHandle("bgm.db", { create: true });
      let writable = await dbfile.createWritable();
      writable.write(ab).then(() => writable.close());
    } catch {}
  }
  try {
    ab = await idb.getItem("bgm.db");
    if (!ab) {
      ab = await (
        await (await root.getFileHandle("bgm.db")).getFile()
      ).arrayBuffer();
      if (!ab.byteLength) throw new Error();
    }
    fetch("bgm_7z", { method: "HEAD" }).then(r => {
      if (r.headers.get("content-length") !== localStorage.getItem("7zsize"))
        getdb();
    });
  } catch {
    await getdb();
  }

  let p = sqlite3.wasm.allocFromTypedArray(ab);
  let db = new sqlite3.oo1.DB("bgm.db");
  let rc = sqlite3.capi.sqlite3_deserialize(
    db.pointer,
    "main",
    p,
    ab.byteLength,
    ab.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE
  );
  db.checkRc(rc);
  window.db = db;
}
async function initTags() {
  tags = await (await fetch("tags.json")).json();
  infotags = await (await fetch("infotags.json")).json();
  infokeys = infotags.map(([key, count]) => key);
  nsfwtags = await (await fetch("nsfwtags.json")).json();
  let tagpanel = gel("tagpanel");
  let first = 1;
  gel("showtags").onclick = () => {
    first ? gel("showall").click() : (first = 1);
    tagpanel.classList.toggle("show");
  };
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") tagpanel.classList.remove("show");
    if (e.key === "q" && e.ctrlKey) tagpanel.classList.toggle("show");
  });
  let obj = {
    get tags() {},
  };
  function initbox(btn, box, tags, curr) {
    tags = [...tags];
    let per = 200;
    if (curr) per = 999;
    btn.onclick = () => {
      tagpanel
        .querySelectorAll(".tagbox")
        .forEach(el => el.classList.remove("show"));
      tagpanel
        .querySelectorAll(".radio")
        .forEach(el => el.classList.remove("chosed"));
      box.classList.add("show");
      btn.classList.add("chosed");
      if (curr) {
        let counter = new Map();
        bgmbox
          .querySelectorAll(".bgm")
          .forEach(el =>
            el.sbj.tags.forEach(([tag, count]) =>
              counter.set(tag, (counter.get(tag) || count) + 1)
            )
          );
        tags = Array.from(counter).sort((a, b) => b[1] - a[1]);
        box.replaceChildren();
        loadtags();
      }
    };
    function loadtags() {
      for (let _ of Array(per)) {
        if (!tags.length) break;
        let [tag, count] = tags.shift();
        let span = nel("span");
        let name = nel("b");
        let small = nel("small");
        name.innerText = tag;
        small.innerText = count;
        span.append(name);
        span.append(small);
        box.append(span);
      }
    }
    box.onwheel = e => {
      pvtscroll(e, box);
      e.stopPropagation();
      if (
        box.scrollTop + box.clientHeight >
        box.scrollHeight - box.clientHeight
      )
        loadtags();
    };
    loadtags();
  }
  initbox(gel("showall"), gel("alltagbox"), tags);
  initbox(gel("shownsfw"), gel("nsfwtagbox"), nsfwtags);
  initbox(gel("showcurr"), gel("currtagbox"), [], 1);
  tagpanel.onclick = e => {
    let span = e.target.closest("span");
    if (span) {
      searchbar.value +=
        (searchbar.value.endsWith(" ") ||
        searchbar.value === "" ||
        searchbar.value.endsWith("|")
          ? ""
          : " ") +
        span.querySelector("b").innerText +
        " ";
      searchbar.oninput();
      searchbar.focus();
    }
  };
  tagpanel.onwheel = e => e.preventDefault();
  gel("showall").click();
}
async function initPrompt() {
  let ul = gel("prompts");
  let liCount = 20;
  let lis = Array(liCount)
    .fill()
    .map((_, i) => nel("li"));
  ul.replaceChildren(...lis);
  function autocomplete() {
    let text = searchbar.value;
    let lastSpace = text.lastIndexOf(" ");
    let lastWord = text.slice(lastSpace + 1).toLowerCase();
    prev = text.slice(0, lastSpace + 1);
    let prevTags = prev.split(" ");
    if (!lastWord) return ul.classList.remove("show");
    ul.classList.add("show");
    let chars = lastWord.split("");
    let filtered = [];
    function filterTag(tags, gray) {
      tags.some(([tag, count]) => {
        if (filtered.length > liCount) return 1;
        if (prevTags.includes(tag)) return;
        if (count < tagnum.value) return;
        let rest = tag.toLowerCase();
        let indexes = [];
        let failed = 0;
        chars.some(c => {
          let index = rest.indexOf(c);
          if (index === -1) return (failed = 1);
          rest = rest.slice(index + 1);
          indexes.push(index);
        });
        if (failed) return;
        filtered.push({
          tag,
          indexes,
          count,
          gray,
        });
      });
    }
    filterTag(infotags, 1);
    if (nsfw.checked) filterTag(nsfwtags);
    else filterTag(tags);
    if (!filtered.length) return ul.classList.remove("show");
    let liIndex = 0;
    filtered.some(({ tag, indexes, count, gray }) => {
      if (liIndex >= liCount) return 1;
      let chars = tag.split("");
      let lastmark;
      indexes.reduce((index, i) => {
        index += i;
        if (index && !i) {
          lastmark.innerText += chars[index];
          chars[index] = "";
        } else {
          lastmark = nel("mark");
          lastmark.innerText = chars[index];
          chars[index] = lastmark;
        }
        return ++index;
      }, 0);
      let li = lis[liIndex];
      let word = nel("span");
      word.replaceChildren(...chars);
      word.normalize();
      li.replaceChildren(word, count);
      li.classList.remove("hide");
      li.tag = tag;
      if (gray) li.classList.add("gray");
      else li.classList.remove("gray");
      ++liIndex;
    });
    lastLi = lis[liIndex - 1];
    lis.slice(liIndex).forEach(li => li.classList.add("hide"));
    updateFocus(ul.firstChild);
  }
  let prev;
  let focusLi;
  let lastLi;
  function updateFocus(li) {
    focusLi = li;
    ul.querySelector(".focus")?.classList.remove("focus");
    focusLi.classList.add("focus");
  }
  function select() {
    if (focusLi.matches(".hide")) return;
    searchbar.value =
      prev + focusLi.tag + (focusLi.classList.contains("gray") ? ":" : " ");
    oninput();
  }
  let throttled = throttle(autocomplete, 250);
  let oninput = () => {
    throttled();
    searchbar.style.width = "";
    searchbar.style.width = Math.max(200, searchbar.scrollWidth + 10) + "px";
  };
  searchbar.oninput = oninput;
  searchbar.onfocus = autocomplete;
  searchbar.onkeydown = e => {
    let preventDefault = true;
    if (e.key === "Tab") {
      select();
    } else if (e.key === "ArrowDown" || (e.key === " " && e.ctrlKey))
      updateFocus(
        focusLi === lastLi ? ul.firstChild : focusLi.nextElementSibling
      );
    else if (e.key === "ArrowUp" || (e.key === " " && e.shiftKey))
      updateFocus(
        focusLi === ul.firstChild ? lastLi : focusLi.previousElementSibling
      );
    else if (e.key === "Enter") {
      searchbar.blur();
      search();
    } else if (e.key === "Escape") {
      searchbar.blur();
    } else if (e.ctrlKey && e.key === "d") {
      e.preventDefault();
      let text = searchbar.value;
      let start = searchbar.selectionStart;
      let end = searchbar.selectionEnd;
      while (start > 0 && text[start - 1] !== " ") start--;
      while (end < text.length && text[end] !== " ") end++;
      searchbar.setSelectionRange(start, end);
      oninput();
    } else if (e.ctrlKey && e.key === "Backspace") {
      let text = searchbar.value;
      let start = searchbar.selectionStart;
      let end = searchbar.selectionEnd;
      if (start === end) {
        while (start > 0 && text[start - 1] !== " ") start--;
        searchbar.value = text.slice(0, start) + text.slice(end);
        searchbar.setSelectionRange(start, start);
        e.preventDefault();
      }
    } else preventDefault = false;
    if (preventDefault) e.preventDefault();
  };
  document.addEventListener("keydown", e => {
    if (e.key === "f" && e.ctrlKey) {
      e.preventDefault();
      searchbar.focus();
    }
  });
  ul.onmousedown = e => {
    let li = e.target.closest("li");
    if (li) {
      e.preventDefault();
      updateFocus(li);
      select();
    }
  };
  searchbar.onblur = () => ul.classList.remove("show");
}
async function initCover() {
  let timer;
  let coverwrap = gel("coverwrap");
  let cover = gel("cover");
  let infobox = gel("infobox");
  let summary = gel("summary");
  cover.onwheel = e => e.preventDefault();
  infobox.onwheel = pvtscroll;
  summary.onwheel = pvtscroll;
  bgmbox.addEventListener("mouseover", e => {
    let t = e.target;
    if (t.matches(".thumb")) {
      let sbj = t.closest(".bgm").sbj;
      let coversrc = t.src.replace("r/200/", "");
      if (!timer || cover.src != coversrc) {
        timer = setTimeout(() => {
          clearTimeout(timer);
          cover.src = coversrc;
          coverwrap.style = "";
          infobox.style = "";
          let rect = t.getBoundingClientRect();
          let left = rect.left;
          let right = bgmbox.clientWidth - rect.right;
          let w = (del.clientHeight * t.width) / t.height;
          let l, r;
          if (left > right) {
            coverwrap.style.right = right + "px";
            l = right + w;
            r = right;
          } else {
            coverwrap.style.left = left + "px";
            r = left + w;
            l = left;
          }
          if (l > r) infobox.style.right = 100 + "%";
          else infobox.style.left = 100 + "%";
          summary.innerText = sbj.summary;
          infobox.innerHTML = Object.entries(JSON.parse(sbj.infobox))
            .map(
              ([k, v]) =>
                `<b>${k}</b>：${v instanceof Array ? v.join("，") : v}`
            )
            .join("<br>");
          coverwrap.classList.remove("hide");
        }, 500);
      }
    }
  });
  document.addEventListener("mouseout", e => {
    clearTimeout(timer);
    timer = null;
    if (
      e.relatedTarget &&
      !e.relatedTarget?.closest("#cover,.thumb,#summary,#infobox")
    )
      coverwrap.classList.add("hide");
  });
  coverwrap.onclick = e => {
    if (e.target === cover) coverwrap.classList.add("hide");
  };
}
async function inits() {
  initBox();
  await initBar();
  await initDB();
  await initTags();
  await initPrompt();
  await initCover();
  search();
}
inits();