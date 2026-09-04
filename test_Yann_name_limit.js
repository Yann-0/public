/**
 * test_Yann profile only: loads the Name editor as a real HTML document in an iframe.
 * Hub sanitizes setHtml (strips maxlength / on* handlers), so the input must not live there.
 */
(function () {
    var MAX_LEN = 10;
    var ENTITY_TYPE = "configuration/entityTypes/test_Yann";
    var NAME_TYPE = ENTITY_TYPE + "/attributes/Name";
    var EDITOR_URL =
        "https://cdn.statically.io/gh/Yann-0/public@main/test_Yann_name_limit.html";
    var currentName = "";
    var nameMeta = null;

    function isTestYann(entity) {
        return !!(entity && entity.type === ENTITY_TYPE);
    }

    function clip(value) {
        return String(value == null ? "" : value).slice(0, MAX_LEN);
    }

    function nameFromEntity(entity) {
        if (!isTestYann(entity) || !entity.attributes || !entity.attributes.Name) {
            nameMeta = { type: NAME_TYPE };
            return "";
        }
        var values = entity.attributes.Name;
        var ov = null;
        for (var i = 0; i < values.length; i++) {
            if (values[i].ov !== false) {
                ov = values[i];
                break;
            }
        }
        var chosen = ov || values[0] || {};
        nameMeta = {
            type: chosen.type || NAME_TYPE,
            uri: chosen.uri
        };
        return clip(chosen.value);
    }

    function render() {
        var src = EDITOR_URL + "?v=" + encodeURIComponent(currentName);
        UI.setHtml(
            '<iframe title="Name" src="' +
                src +
                '" style="width:100%;height:168px;border:0;display:block;background:#fff;"></iframe>'
        );
    }

    function nameAttribute() {
        var next = {
            type: (nameMeta && nameMeta.type) || NAME_TYPE,
            value: clip(currentName)
        };
        if (nameMeta && nameMeta.uri) {
            next.uri = nameMeta.uri;
        }
        return next;
    }

    function injectEntity(entity) {
        if (!isTestYann(entity)) {
            return;
        }
        entity.attributes = entity.attributes || {};
        var existing = entity.attributes.Name && entity.attributes.Name[0];
        if (existing && existing.value != null) {
            existing.value = clip(existing.value);
            return;
        }
        entity.attributes.Name = [nameAttribute()];
    }

    function injectName(payload) {
        if (payload == null) {
            return payload;
        }
        if (Array.isArray(payload)) {
            if (payload.length && payload[0] && payload[0].type === ENTITY_TYPE) {
                for (var i = 0; i < payload.length; i++) {
                    injectEntity(payload[i]);
                }
                return payload;
            }
            return payload;
        }
        if (typeof payload === "object") {
            injectEntity(payload);
        }
        return payload;
    }

    function parseData(data) {
        if (typeof data !== "string") {
            return data;
        }
        try {
            return JSON.parse(data);
        } catch (e) {
            return data;
        }
    }

    UI.setHeight(168);
    render();

    UI.getEntity().then(function (entity) {
        currentName = nameFromEntity(entity);
        render();
    });

    UI.onEvent(function (type, data) {
        if (type === "updateEntity") {
            var next = nameFromEntity(data);
            if (next !== currentName) {
                currentName = next;
                render();
            }
        }
    });

    UI.onApiRequest(function (urlOrParams, method, headers, data) {
        var url = urlOrParams;
        var tenant;
        if (urlOrParams && typeof urlOrParams === "object") {
            url = urlOrParams.url;
            method = urlOrParams.method;
            headers = urlOrParams.headers;
            data = urlOrParams.data;
            tenant = urlOrParams.tenant;
        }
        var verb = String(method || "GET").toUpperCase();
        if (verb === "POST" || verb === "PUT" || verb === "PATCH") {
            data = injectName(parseData(data));
        }
        return UI.api(url, verb, tenant, headers, data);
    });
})();
