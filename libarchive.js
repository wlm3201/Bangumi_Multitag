(() => {
  /**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: Apache-2.0
   */
  const e = Symbol("Comlink.proxy"),
    t = Symbol("Comlink.endpoint"),
    n = Symbol("Comlink.releaseProxy"),
    r = Symbol("Comlink.finalizer"),
    i = Symbol("Comlink.thrown"),
    s = e => ("object" == typeof e && null !== e) || "function" == typeof e,
    a = new Map([
      [
        "proxy",
        {
          canHandle: t => s(t) && t[e],
          serialize(e) {
            const { port1: t, port2: n } = new MessageChannel();
            return o(e, t), [n, [n]];
          },
          deserialize: e => (e.start(), l(e)),
        },
      ],
      [
        "throw",
        {
          canHandle: e => s(e) && i in e,
          serialize({ value: e }) {
            let t;
            return (
              (t =
                e instanceof Error
                  ? {
                      isError: !0,
                      value: {
                        message: e.message,
                        name: e.name,
                        stack: e.stack,
                      },
                    }
                  : { isError: !1, value: e }),
              [t, []]
            );
          },
          deserialize(e) {
            if (e.isError)
              throw Object.assign(new Error(e.value.message), e.value);
            throw e.value;
          },
        },
      ],
    ]);
  function o(e, t = globalThis, n = ["*"]) {
    t.addEventListener("message", function s(a) {
      if (!a || !a.data) return;
      if (
        !(function (e, t) {
          for (const n of e) {
            if (t === n || "*" === n) return !0;
            if (n instanceof RegExp && n.test(t)) return !0;
          }
          return !1;
        })(n, a.origin)
      )
        return void console.warn(
          `Invalid origin '${a.origin}' for comlink proxy`
        );
      const { id: l, type: u, path: p } = Object.assign({ path: [] }, a.data),
        h = (a.data.argumentList || []).map(v);
      let f;
      try {
        const t = p.slice(0, -1).reduce((e, t) => e[t], e),
          n = p.reduce((e, t) => e[t], e);
        switch (u) {
          case "GET":
            f = n;
            break;
          case "SET":
            (t[p.slice(-1)[0]] = v(a.data.value)), (f = !0);
            break;
          case "APPLY":
            f = n.apply(t, h);
            break;
          case "CONSTRUCT":
            f = w(new n(...h));
            break;
          case "ENDPOINT":
            {
              const { port1: t, port2: n } = new MessageChannel();
              o(e, n),
                (f = (function (e, t) {
                  return g.set(e, t), e;
                })(t, [t]));
            }
            break;
          case "RELEASE":
            f = void 0;
            break;
          default:
            return;
        }
      } catch (e) {
        f = { value: e, [i]: 0 };
      }
      Promise.resolve(f)
        .catch(e => ({ value: e, [i]: 0 }))
        .then(n => {
          const [i, a] = y(n);
          t.postMessage(Object.assign(Object.assign({}, i), { id: l }), a),
            "RELEASE" === u &&
              (t.removeEventListener("message", s),
              c(t),
              r in e && "function" == typeof e[r] && e[r]());
        })
        .catch(e => {
          const [n, r] = y({
            value: new TypeError("Unserializable return value"),
            [i]: 0,
          });
          t.postMessage(Object.assign(Object.assign({}, n), { id: l }), r);
        });
    }),
      t.start && t.start();
  }
  function c(e) {
    (function (e) {
      return "MessagePort" === e.constructor.name;
    })(e) && e.close();
  }
  function l(e, t) {
    return d(e, [], t);
  }
  function u(e) {
    if (e) throw new Error("Proxy has been released and is not useable");
  }
  function p(e) {
    return E(e, { type: "RELEASE" }).then(() => {
      c(e);
    });
  }
  const h = new WeakMap(),
    f =
      "FinalizationRegistry" in globalThis &&
      new FinalizationRegistry(e => {
        const t = (h.get(e) || 0) - 1;
        h.set(e, t), 0 === t && p(e);
      });
  function d(e, r = [], i = function () {}) {
    let s = !1;
    const a = new Proxy(i, {
      get(t, i) {
        if ((u(s), i === n))
          return () => {
            !(function (e) {
              f && f.unregister(e);
            })(a),
              p(e),
              (s = !0);
          };
        if ("then" === i) {
          if (0 === r.length) return { then: () => a };
          const t = E(e, { type: "GET", path: r.map(e => e.toString()) }).then(
            v
          );
          return t.then.bind(t);
        }
        return d(e, [...r, i]);
      },
      set(t, n, i) {
        u(s);
        const [a, o] = y(i);
        return E(
          e,
          { type: "SET", path: [...r, n].map(e => e.toString()), value: a },
          o
        ).then(v);
      },
      apply(n, i, a) {
        u(s);
        const o = r[r.length - 1];
        if (o === t) return E(e, { type: "ENDPOINT" }).then(v);
        if ("bind" === o) return d(e, r.slice(0, -1));
        const [c, l] = m(a);
        return E(
          e,
          { type: "APPLY", path: r.map(e => e.toString()), argumentList: c },
          l
        ).then(v);
      },
      construct(t, n) {
        u(s);
        const [i, a] = m(n);
        return E(
          e,
          {
            type: "CONSTRUCT",
            path: r.map(e => e.toString()),
            argumentList: i,
          },
          a
        ).then(v);
      },
    });
    return (
      (function (e, t) {
        const n = (h.get(t) || 0) + 1;
        h.set(t, n), f && f.register(e, t, e);
      })(a, e),
      a
    );
  }
  function m(e) {
    const t = e.map(y);
    return [
      t.map(e => e[0]),
      ((n = t.map(e => e[1])), Array.prototype.concat.apply([], n)),
    ];
    var n;
  }
  const g = new WeakMap();
  function w(t) {
    return Object.assign(t, { [e]: !0 });
  }
  function y(e) {
    for (const [t, n] of a)
      if (n.canHandle(e)) {
        const [r, i] = n.serialize(e);
        return [{ type: "HANDLER", name: t, value: r }, i];
      }
    return [{ type: "RAW", value: e }, g.get(e) || []];
  }
  function v(e) {
    switch (e.type) {
      case "HANDLER":
        return a.get(e.name).deserialize(e.value);
      case "RAW":
        return e.value;
    }
  }
  function E(e, t, n) {
    return new Promise(r => {
      const i = new Array(4)
        .fill(0)
        .map(() =>
          Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)
        )
        .join("-");
      e.addEventListener("message", function t(n) {
        n.data &&
          n.data.id &&
          n.data.id === i &&
          (e.removeEventListener("message", t), r(n.data));
      }),
        e.start && e.start(),
        e.postMessage(Object.assign({ id: i }, t), n);
    });
  }
  class R {
    constructor(e, t, n, r, i) {
      (this._name = e),
        (this._size = t),
        (this._path = n),
        (this._lastModified = r),
        (this._archiveRef = i);
    }
    get name() {
      return this._name;
    }
    get size() {
      return this._size;
    }
    get lastModified() {
      return this._lastModified;
    }
    extract() {
      return this._archiveRef.extractSingleFile(this._path);
    }
  }
  function b(e) {
    if (e instanceof File || e instanceof R || null === e) return e;
    const t = {};
    for (const n of Object.keys(e)) t[n] = b(e[n]);
    return t;
  }
  function P(e, t = "") {
    const n = [];
    for (const r of Object.keys(e))
      e[r] instanceof File || e[r] instanceof R || null === e[r]
        ? n.push({ file: e[r] || r, path: t })
        : n.push(...P(e[r], `${t}${r}/`));
    return n;
  }
  function S(e, t) {
    const n = t.split("/");
    "" === n[n.length - 1] && n.pop();
    let r = e,
      i = null;
    for (const e of n) (r[e] = r[e] || {}), (i = r), (r = r[e]);
    return [i, n[n.length - 1]];
  }
  class A {
    constructor(e, t, n) {
      (this._content = {}),
        (this._processed = 0),
        (this.file = e),
        (this.client = t),
        (this.worker = n);
    }
    open() {
      return (
        (this._content = {}),
        (this._processed = 0),
        new Promise((e, t) => {
          this.client.open(
            this.file,
            w(() => {
              e(this);
            })
          );
        })
      );
    }
    async close() {
      var e;
      null === (e = this.worker) || void 0 === e || e.terminate(),
        (this.worker = null),
        (this.client = null),
        (this.file = null);
    }
    async hasEncryptedData() {
      return await this.client.hasEncryptedData();
    }
    async usePassword(e) {
      await this.client.usePassword(e);
    }
    async setLocale(e) {
      await this.client.setLocale(e);
    }
    async getFilesObject() {
      if (this._processed > 0)
        return Promise.resolve().then(() => this._content);
      return (
        (await this.client.listFiles()).forEach(e => {
          const [t, n] = S(this._content, e.path);
          "FILE" === e.type &&
            (t[n] = new R(e.fileName, e.size, e.path, e.lastModified, this));
        }),
        (this._processed = 1),
        b(this._content)
      );
    }
    getFilesArray() {
      return this.getFilesObject().then(e => P(e));
    }
    async extractSingleFile(e) {
      if (null === this.worker) throw new Error("Archive already closed");
      const t = await this.client.extractSingleFile(e);
      return new File([t.fileData], t.fileName, {
        type: "application/octet-stream",
        lastModified: t.lastModified / 1e6,
      });
    }
    async extractFiles(e = void 0) {
      var t;
      if (this._processed > 1)
        return Promise.resolve().then(() => this._content);
      return (
        (await this.client.extractFiles()).forEach(t => {
          const [n, r] = S(this._content, t.path);
          "FILE" === t.type &&
            ((n[r] = new File([t.fileData], t.fileName, {
              type: "application/octet-stream",
            })),
            void 0 !== e &&
              setTimeout(e.bind(null, { file: n[r], path: t.path })));
        }),
        (this._processed = 2),
        null === (t = this.worker) || void 0 === t || t.terminate(),
        b(this._content)
      );
    }
  }
  var _, k;
  !(function (e) {
    (e.SEVEN_ZIP = "7zip"),
      (e.AR = "ar"),
      (e.ARBSD = "arbsd"),
      (e.ARGNU = "argnu"),
      (e.ARSVR4 = "arsvr4"),
      (e.BIN = "bin"),
      (e.BSDTAR = "bsdtar"),
      (e.CD9660 = "cd9660"),
      (e.CPIO = "cpio"),
      (e.GNUTAR = "gnutar"),
      (e.ISO = "iso"),
      (e.ISO9660 = "iso9660"),
      (e.MTREE = "mtree"),
      (e.MTREE_CLASSIC = "mtree-classic"),
      (e.NEWC = "newc"),
      (e.ODC = "odc"),
      (e.OLDTAR = "oldtar"),
      (e.PAX = "pax"),
      (e.PAXR = "paxr"),
      (e.POSIX = "posix"),
      (e.PWB = "pwb"),
      (e.RAW = "raw"),
      (e.RPAX = "rpax"),
      (e.SHAR = "shar"),
      (e.SHARDUMP = "shardump"),
      (e.USTAR = "ustar"),
      (e.V7TAR = "v7tar"),
      (e.V7 = "v7"),
      (e.WARC = "warc"),
      (e.XAR = "xar"),
      (e.ZIP = "zip");
  })(_ || (_ = {})),
    (function (e) {
      (e.B64ENCODE = "b64encode"),
        (e.BZIP2 = "bzip2"),
        (e.COMPRESS = "compress"),
        (e.GRZIP = "grzip"),
        (e.GZIP = "gzip"),
        (e.LRZIP = "lrzip"),
        (e.LZ4 = "lz4"),
        (e.LZIP = "lzip"),
        (e.LZMA = "lzma"),
        (e.LZOP = "lzop"),
        (e.UUENCODE = "uuencode"),
        (e.XZ = "xz"),
        (e.ZSTD = "zstd"),
        (e.NONE = "none");
    })(k || (k = {}));
  class O {
    static init(e = null) {
      return (O._options = e || {}), O._options;
    }
    static async open(e) {
      const t = O.getWorker(O._options),
        n = await O.getClient(t, O._options),
        r = new A(e, n, t);
      return await r.open();
    }
    static async write({
      files: e,
      outputFileName: t,
      compression: n,
      format: r,
      passphrase: i = null,
    }) {
      const s = O.getWorker(O._options),
        a = await O.getClient(s, O._options),
        o = await a.writeArchive(e, n, r, i);
      return (
        s.terminate(), new File([o], t, { type: "application/octet-stream" })
      );
    }
    static getWorker(e) {
      return e.getWorker
        ? e.getWorker()
        : new Worker(
            e.workerUrl || new URL("./worker-bundle.js", window.location.href),
            { type: "module" }
          );
    }
    static async getClient(e, t) {
      var n;
      const r =
        (null === (n = t.createClient) || void 0 === n
          ? void 0
          : n.call(t, e)) || l(e);
      let { promise: i, resolve: s } = Promise.withResolvers();
      const a = await new r(
        w(() => {
          s();
        })
      );
      return await i, a;
    }
  }
  (O._options = {}),
    Promise.withResolvers ||
      (Promise.withResolvers = function () {
        var e,
          t,
          n = new this(function (n, r) {
            (e = n), (t = r);
          });
        return { resolve: e, reject: t, promise: n };
      });
  // export { O as Archive, k as ArchiveCompression, _ as ArchiveFormat };
  window.Archive = O;
})();
