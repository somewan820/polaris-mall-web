(function (global) {
  var KEY = "polaris.mall.session";

  function safeParse(text) {
    try {
      return JSON.parse(text);
    } catch (_err) {
      return null;
    }
  }

  function load() {
    var raw = global.localStorage.getItem(KEY);
    if (!raw) {
      return { accessToken: "", refreshToken: "", user: null };
    }
    var parsed = safeParse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { accessToken: "", refreshToken: "", user: null };
    }
    return {
      accessToken: parsed.accessToken || "",
      refreshToken: parsed.refreshToken || "",
      user: parsed.user || null,
    };
  }

  function save(session) {
    global.localStorage.setItem(KEY, JSON.stringify(session));
  }

  function clear() {
    global.localStorage.removeItem(KEY);
  }

  global.Polaris = global.Polaris || {};
  global.Polaris.session = {
    load: load,
    save: save,
    clear: clear,
  };
})(window);

