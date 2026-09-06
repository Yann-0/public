/**
 * test_Yann only: Name max 10 characters.
 * Hub nui paints DVF / validationErrors in the profile banner, so this script
 * 1) renders Name + the error under the input in the Custom facet
 * 2) blocks the write without returning a DVF envelope
 */
(function () {
    var MAX_LEN = 10;
    var ENTITY_TYPE = "configuration/entityTypes/test_Yann";
    var NAME_TYPE = ENTITY_TYPE + "/attributes/Name";
    var LIMIT_MESSAGE = "Name must be 10 characters or fewer.";
    var currentName = "";
    var nameMeta = null;
    var entityUri = null;
    var canRender = false;

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

    function urlOf(urlOrParams) {
        if (urlOrParams && typeof urlOrParams === "object") {
            return String(urlOrParams.url || "");
        }
        return String(urlOrParams || "");
    }

    function methodOf(urlOrParams, method) {
        if (urlOrParams && typeof urlOrParams === "object" && urlOrParams.method) {
            return String(urlOrParams.method).toUpperCase();
        }
        return String(method || "GET").toUpperCase();
    }

    function isWrite(method) {
        return method === "POST" || method === "PUT" || method === "PATCH";
    }

    function nameValueTooLong(value) {
        return value != null && String(value).length > MAX_LEN;
    }

    function nameFieldTooLong(name) {
        if (name == null) {
            return false;
        }
        if (typeof name === "string") {
            return nameValueTooLong(name);
        }
        if (Array.isArray(name)) {
            for (var i = 0; i < name.length; i++) {
                if (nameFieldTooLong(name[i])) {
                    return true;
                }
            }
            return false;
        }
        if (typeof name === "object") {
            if (name.value != null) {
                return nameValueTooLong(name.value);
            }
        }
        return false;
    }

    function payloadNameTooLong(payload) {
        if (payload == null) {
            return false;
        }
        if (typeof payload === "string") {
            return nameValueTooLong(payload);
        }
        if (Array.isArray(payload)) {
            for (var i = 0; i < payload.length; i++) {
                if (payloadNameTooLong(payload[i])) {
                    return true;
                }
            }
            return false;
        }
        if (typeof payload !== "object") {
            return false;
        }
        if (payload.object) {
            return payloadNameTooLong(payload.object);
        }
        if (payload.attributes) {
            return nameFieldTooLong(payload.attributes.Name);
        }
        if (payload.Name) {
            return nameFieldTooLong(payload.Name);
        }
        if (payload.type && payload.type !== ENTITY_TYPE && payload.type !== NAME_TYPE) {
            return false;
        }
        return payload.value != null && nameValueTooLong(payload.value);
    }

    function isTestYann(entity) {
        return !!(entity && entity.type === ENTITY_TYPE);
    }

    function firstEntity(payload) {
        if (!payload) {
            return null;
        }
        if (Array.isArray(payload)) {
            for (var i = 0; i < payload.length; i++) {
                if (payload[i] && payload[i].type) {
                    return payload[i];
                }
                if (payload[i] && payload[i].object && payload[i].object.type) {
                    return payload[i].object;
                }
            }
            return payload[0] || null;
        }
        if (payload.object && payload.object.type) {
            return payload.object;
        }
        return payload;
    }

    function applyEntity(entity) {
        if (!isTestYann(entity)) {
            return;
        }
        entityUri = entity.uri || entityUri;
        var values = entity.attributes && entity.attributes.Name;
        if (Array.isArray(values) && values[0]) {
            currentName = String(values[0].value == null ? "" : values[0].value);
            nameMeta = values[0];
        } else if (values && values.value != null) {
            currentName = String(values.value);
            nameMeta = values;
        }
        render();
    }

    function render() {
        if (!canRender) {
            return;
        }
        var tooLong = currentName.length > MAX_LEN;
        try {
            UI.setVisibility("visible");
            UI.setHtml(
                tooLong
                    ? '<div id="ty-err" style="font-family:Roboto,Helvetica,Arial,sans-serif;color:#d32f2f;font-size:12px;line-height:16px;padding:4px 16px 12px;">' +
                      LIMIT_MESSAGE +
                      "</div>"
                    : '<div id="ty-err"></div>'
            );
            UI.setHeight(tooLong ? 44 : 8);
        } catch (e) {
            canRender = false;
        }
    }

    function valueFromUiAction(data) {
        if (data == null) {
            return null;
        }
        if (typeof data === "string") {
            return data;
        }
        if (data.value != null) {
            return String(data.value);
        }
        if (data.event && data.event.target && data.event.target.value != null) {
            return String(data.event.target.value);
        }
        if (data.target && data.target.value != null) {
            return String(data.target.value);
        }
        return null;
    }

    function blockedBody() {
        return [{ successful: false }];
    }

    function send(callback, result, status, headers) {
        if (typeof callback === "function") {
            callback(result, status, headers);
        }
        return result;
    }

    function block(callback) {
        try {
            UI.setVisibility("visible");
            UI.setHtml(
                '<div id="ty-err" style="font-family:Roboto,Helvetica,Arial,sans-serif;color:#d32f2f;font-size:12px;line-height:16px;padding:4px 16px 12px;">' +
                    LIMIT_MESSAGE +
                    "</div>"
            );
            UI.setHeight(44);
        } catch (e) {
            /* customScripts sandbox */
        }
        return send(callback, blockedBody(), 200, {});
    }

    function shouldInspect(url, parsed) {
        if (isTestYann(firstEntity(parsed)) || payloadNameTooLong(parsed)) {
            return true;
        }
        return /\/entities/.test(url);
    }

    function handleWrite(url, method, tenant, headers, data, callback) {
        var parsed = parseData(data);
        if (currentName.length > MAX_LEN || payloadNameTooLong(parsed)) {
            return block(callback);
        }
        if (!shouldInspect(url, parsed)) {
            return UI.api(url, method, tenant, headers, data, callback);
        }
        var entity = firstEntity(parsed);
        if (isTestYann(entity) || payloadNameTooLong(parsed)) {
            return payloadNameTooLong(parsed) ? block(callback) : UI.api(url, method, tenant, headers, data, callback);
        }
        return UI.getEntity().then(
            function (loaded) {
                if (!isTestYann(loaded)) {
                    return UI.api(url, method, tenant, headers, data, callback);
                }
                applyEntity(loaded);
                if (currentName.length > MAX_LEN || payloadNameTooLong(parsed)) {
                    return block(callback);
                }
                return UI.api(url, method, tenant, headers, data, callback);
            },
            function () {
                return UI.api(url, method, tenant, headers, data, callback);
            }
        );
    }

    try {
        UI.setVisibility("visible");
        canRender = true;
        render();
    } catch (e) {
        canRender = false;
    }

    UI.getEntity().then(applyEntity, function () {});

    UI.onEvent(function (type, data) {
        if (type === "updateEntity") {
            applyEntity(data);
            return;
        }
        if (type === "uiAction") {
            var next = valueFromUiAction(data);
            if (next != null) {
                currentName = next;
                render();
            }
        }
    });

    UI.onApiRequest(function (urlOrParams, method, headers, data, callback) {
        var url = urlOf(urlOrParams);
        var tenant;
        if (urlOrParams && typeof urlOrParams === "object") {
            headers = urlOrParams.headers || headers;
            data = urlOrParams.data;
            tenant = urlOrParams.tenant;
        }
        var verb = methodOf(urlOrParams, method);
        if (!isWrite(verb)) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        return handleWrite(url, verb, tenant, headers, data, callback);
    });
})();
