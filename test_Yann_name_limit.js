/**
 * test_Yann profile only: Name editor with a live 10-character cap and Hub-like styling.
 * Runs in the Custom facet iframe (maxlength + CSS work here). Does not touch other types.
 */
(function () {
    var MAX_LEN = 10;
    var ENTITY_TYPE = "configuration/entityTypes/test_Yann";
    var NAME_TYPE = ENTITY_TYPE + "/attributes/Name";
    var currentName = "";
    var nameMeta = null;

    function isTestYann(entity) {
        return !!(entity && entity.type === ENTITY_TYPE);
    }

    function clip(value) {
        return String(value == null ? "" : value).slice(0, MAX_LEN);
    }

    function escapeHtml(value) {
        return clip(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
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

    function counterHtml() {
        var atMax = currentName.length >= MAX_LEN;
        var color = atMax ? "#b42318" : "#6a6d70";
        return (
            '<span id="testYannNameCount" style="color:' +
            color +
            ';font-variant-numeric:tabular-nums;">' +
            currentName.length +
            " / " +
            MAX_LEN +
            "</span>"
        );
    }

    function render() {
        UI.setHtml(
            '<div class="ty-name">' +
                '<div class="ty-name-header">' +
                '<label for="testYannName">Name</label>' +
                '<div id="testYannNameHint" class="ty-count">' +
                counterHtml() +
                "</div>" +
                "</div>" +
                '<input id="testYannName" type="text" maxlength="' +
                MAX_LEN +
                '" autocomplete="off" spellcheck="false" data-action="input" value="' +
                escapeHtml(currentName) +
                '" />' +
                '<p class="ty-help">Maximum 10 characters. Extra characters are blocked as you type.</p>' +
                "</div>" +
                "<style>" +
                ".ty-name{font-family:Roboto,Helvetica,Arial,sans-serif;color:#1d232a;padding:12px 16px 8px;box-sizing:border-box;}" +
                ".ty-name-header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px;}" +
                ".ty-name label{font-size:13px;font-weight:600;letter-spacing:0.01em;}" +
                ".ty-count{font-size:12px;font-weight:500;}" +
                "#testYannName{display:block;width:100%;max-width:22ch;box-sizing:border-box;height:36px;" +
                "padding:8px 10px;border:1px solid #89919a;border-radius:4px;font-size:14px;line-height:20px;background:#fff;}" +
                "#testYannName:focus{border-color:#673AB7;outline:2px solid rgba(103,58,183,0.28);outline-offset:1px;}" +
                ".ty-help{margin:8px 0 0;font-size:12px;line-height:16px;color:#6a6d70;}" +
                "</style>"
        );
    }

    function valueFromUiAction(data) {
        if (!data) {
            return currentName;
        }
        if (data.value != null) {
            return data.value;
        }
        if (data.event && data.event.target && data.event.target.value != null) {
            return data.event.target.value;
        }
        return currentName;
    }

    function isNameInput(data) {
        if (!data) {
            return false;
        }
        var id = data.id || data.elementId;
        if (!id && data.event && data.event.target) {
            id = data.event.target.id;
        }
        return id === "testYannName";
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
            return;
        }
        if (type === "uiAction" && isNameInput(data)) {
            currentName = clip(valueFromUiAction(data));
            UI.setChildHtml("testYannNameHint", counterHtml());
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
