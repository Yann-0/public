/**
 * test_Yann profile only: Name editor with a live 10-character cap.
 * Handlers run in the widget HTML (sandbox JS cannot see the input). Does not touch other types.
 */
(function () {
    var MAX_LEN = 10;
    var ENTITY_TYPE = "configuration/entityTypes/test_Yann";
    var NAME_TYPE = ENTITY_TYPE + "/attributes/Name";
    var LIMIT_MESSAGE =
        "Name is limited to 10 characters. The extra character was not added.";
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

    function escapeAttr(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;");
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

    function inputHandlers() {
        return (
            "onkeydown=\"" +
            escapeAttr(
                "var e=event||window.event;" +
                    "if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return;" +
                    "var key=e.key||String.fromCharCode(e.which||e.keyCode||0);" +
                    "if(!key||key.length!==1)return;" +
                    "var el=this,s=el.selectionStart||0,n=el.selectionEnd||0;" +
                    "if(el.value.length-(n-s)>=10){" +
                    "if(e.preventDefault)e.preventDefault();else e.returnValue=false;" +
                    "alert('" +
                    LIMIT_MESSAGE.replace(/'/g, "\\'") +
                    "');}"
            ) +
            "\" oninput=\"" +
            escapeAttr(
                "var el=this,c=document.getElementById('testYannNameCount');" +
                    "if(el.value.length>10)el.value=el.value.slice(0,10);" +
                    "if(c){c.textContent=el.value.length+' / 10';c.style.color=el.value.length>=10?'#b42318':'#6a6d70';}"
            ) +
            "\" onpaste=\"" +
            escapeAttr(
                "var e=event||window.event,el=this;" +
                    "var t=(e.clipboardData||window.clipboardData);" +
                    "t=t?(t.getData('text')||t.getData('Text')||''):'';" +
                    "var s=el.selectionStart||0,n=el.selectionEnd||0;" +
                    "var next=el.value.slice(0,s)+t+el.value.slice(n);" +
                    "if(next.length>10){" +
                    "if(e.preventDefault)e.preventDefault();else e.returnValue=false;" +
                    "el.value=next.slice(0,10);" +
                    "var c=document.getElementById('testYannNameCount');" +
                    "if(c){c.textContent=el.value.length+' / 10';c.style.color='#b42318';}" +
                    "alert('" +
                    LIMIT_MESSAGE.replace(/'/g, "\\'") +
                    "');}"
            ) +
            "\""
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
                '" autocomplete="off" spellcheck="false" data-action="input" ' +
                inputHandlers() +
                ' value="' +
                escapeHtml(currentName) +
                '" />' +
                '<p class="ty-help">Maximum 10 characters. Extra characters are blocked and an alert is shown.</p>' +
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

    function extractUiValue(data) {
        data = parseData(data);
        if (!data || typeof data !== "object") {
            return null;
        }
        if (data.value != null) {
            return String(data.value);
        }
        var target = data.target || (data.event && (data.event.target || data.event.srcElement));
        if (target && target.value != null) {
            return String(target.value);
        }
        return null;
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
            return;
        }
        if (type === "uiAction") {
            var typed = extractUiValue(data);
            if (typed != null) {
                currentName = clip(typed);
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
