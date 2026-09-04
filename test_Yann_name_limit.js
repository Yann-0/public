/**
 * test_Yann profile only: Name editor with a live 10-character cap and Hub-like styling.
 * At 10 characters, further input is blocked and Hub shows an alert. Does not touch other types.
 */
(function () {
    var MAX_LEN = 10;
    var ENTITY_TYPE = "configuration/entityTypes/test_Yann";
    var NAME_TYPE = ENTITY_TYPE + "/attributes/Name";
    var LIMIT_MESSAGE =
        "Name is limited to 10 characters. The extra character was not added.";
    var currentName = "";
    var nameMeta = null;
    var limitAlertOpen = false;

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

    function showLimitAlert() {
        if (limitAlertOpen) {
            return;
        }
        limitAlertOpen = true;
        var done = function () {
            limitAlertOpen = false;
        };
        try {
            var pending = UI.alert(LIMIT_MESSAGE);
            if (pending && typeof pending.then === "function") {
                pending.then(done, done);
                return;
            }
        } catch (e) {
            /* fall through */
        }
        done();
    }

    function eventFrom(data) {
        return (data && data.event) || data || {};
    }

    function nameInputFrom(data) {
        var event = eventFrom(data);
        if (event.target && event.target.id === "testYannName") {
            return event.target;
        }
        if (typeof document !== "undefined") {
            return document.getElementById("testYannName");
        }
        return null;
    }

    function allowedInsertLength(input) {
        var value = input && input.value != null ? String(input.value) : currentName;
        var start = input && typeof input.selectionStart === "number" ? input.selectionStart : value.length;
        var end = input && typeof input.selectionEnd === "number" ? input.selectionEnd : value.length;
        return Math.max(0, MAX_LEN - (value.length - (end - start)));
    }

    function isPrintableKey(event) {
        if (!event) {
            return false;
        }
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return false;
        }
        if (event.isComposing || event.keyCode === 229) {
            return false;
        }
        if (typeof event.key === "string") {
            return event.key.length === 1;
        }
        var code = event.which || event.keyCode;
        return code >= 32 && code <= 126;
    }

    function clipboardText(event) {
        var clip = event && (event.clipboardData || (typeof window !== "undefined" && window.clipboardData));
        if (!clip) {
            return "";
        }
        return clip.getData("text") || clip.getData("Text") || "";
    }

    function blockExtraInput(event, insertLen) {
        var input = event && event.target && event.target.id === "testYannName" ? event.target : nameInputFrom({ event: event });
        if (allowedInsertLength(input) >= insertLen) {
            return false;
        }
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }
        showLimitAlert();
        return true;
    }

    function bindNameInput() {
        var input;
        try {
            input = typeof document !== "undefined" ? document.getElementById("testYannName") : null;
        } catch (e) {
            return;
        }
        if (!input || input.getAttribute("data-ty-bound") === "1") {
            return;
        }
        input.setAttribute("data-ty-bound", "1");
        input.addEventListener("keydown", function (event) {
            if (isPrintableKey(event)) {
                blockExtraInput(event, 1);
            }
        });
        input.addEventListener("beforeinput", function (event) {
            if (!event || event.isComposing) {
                return;
            }
            if (event.inputType && event.inputType.indexOf("insert") !== 0) {
                return;
            }
            var text = event.data != null ? String(event.data) : "";
            if (!text) {
                return;
            }
            blockExtraInput(event, text.length);
        });
        input.addEventListener("paste", function (event) {
            blockExtraInput(event, clipboardText(event).length || 1);
        });
    }

    function render() {
        UI.setHtml(
            '<div class="ty-name" data-action="keydown">' +
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
                "<p class=\"ty-help\">Maximum 10 characters. Extra characters are blocked and an alert is shown.</p>" +
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
        bindNameInput();
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

    function uiActionType(data) {
        if (data && data.event && data.event.type) {
            return data.event.type;
        }
        return (data && (data.type || data.action)) || "";
    }

    function applyNameValue(next) {
        var clipped = clip(next);
        if (String(next) !== clipped) {
            showLimitAlert();
        }
        currentName = clipped;
        UI.setChildHtml("testYannNameHint", counterHtml());
        var input = nameInputFrom();
        if (input && input.value !== currentName) {
            input.value = currentName;
        }
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
        if (type !== "uiAction") {
            return;
        }
        var kind = uiActionType(data);
        if (kind === "keydown") {
            blockExtraInput(eventFrom(data), isPrintableKey(eventFrom(data)) ? 1 : 0);
            return;
        }
        if (kind === "paste") {
            blockExtraInput(eventFrom(data), clipboardText(eventFrom(data)).length || 1);
            return;
        }
        if (isNameInput(data) && (kind === "input" || kind === "change" || !kind)) {
            applyNameValue(valueFromUiAction(data));
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
