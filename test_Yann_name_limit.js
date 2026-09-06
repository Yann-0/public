/**
 * test_Yann only: show the 10-character Name error under the Name field.
 * Hub nui paints DVF / validationErrors in the profile banner, so this script
 * blocks the write and renders the message in this Custom facet instead.
 */
(function () {
    var MAX_LEN = 10;
    var ENTITY_TYPE = "configuration/entityTypes/test_Yann";
    var LIMIT_MESSAGE = "Name must be 10 characters or fewer.";

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

    function nameValuesTooLong(values) {
        if (!values || !values.length) {
            return false;
        }
        for (var i = 0; i < values.length; i++) {
            if (values[i] && values[i].value != null && String(values[i].value).length > MAX_LEN) {
                return true;
            }
        }
        return false;
    }

    function entityNameTooLong(entity) {
        return !!(entity && entity.attributes && nameValuesTooLong(entity.attributes.Name));
    }

    function payloadNameTooLong(payload) {
        if (payload == null) {
            return false;
        }
        if (Array.isArray(payload)) {
            for (var i = 0; i < payload.length; i++) {
                if (entityNameTooLong(payload[i])) {
                    return true;
                }
            }
            return false;
        }
        if (typeof payload !== "object") {
            return false;
        }
        if (payload.attributes || payload.type) {
            return entityNameTooLong(payload);
        }
        return payload.value != null && String(payload.value).length > MAX_LEN;
    }

    function showFieldError(show) {
        try {
            if (show) {
                UI.setVisibility("visible");
                UI.setHtml(
                    '<div style="font-family:Roboto,Helvetica,Arial,sans-serif;color:#d32f2f;font-size:12px;line-height:16px;padding:0 16px 12px;">' +
                        LIMIT_MESSAGE +
                        "</div>"
                );
                UI.setHeight(40);
            } else {
                UI.setHtml("");
                UI.setVisibility("hidden");
                UI.setHeight(1);
            }
        } catch (e) {
            /* setHtml is only available on Custom views */
        }
    }

    function blockedBody() {
        return [{ successful: false }];
    }

    function block(callback) {
        showFieldError(true);
        var body = blockedBody();
        if (typeof callback === "function") {
            callback(body, 200, {});
        }
        return body;
    }

    function forward(url, method, tenant, headers, data, callback) {
        showFieldError(false);
        return UI.api(url, method, tenant, headers, data, callback);
    }

    function handleWrite(url, method, tenant, headers, data, callback) {
        var parsed = parseData(data);
        if (isTestYann(firstEntity(parsed))) {
            return payloadNameTooLong(parsed)
                ? block(callback)
                : forward(url, method, tenant, headers, data, callback);
        }
        if (payloadNameTooLong(parsed) || /\/attributes\/Name(?:\/|\?|$)/.test(url)) {
            return UI.getEntity().then(
                function (entity) {
                    if (!isTestYann(entity)) {
                        return UI.api(url, method, tenant, headers, data, callback);
                    }
                    return payloadNameTooLong(parsed)
                        ? block(callback)
                        : forward(url, method, tenant, headers, data, callback);
                },
                function () {
                    return UI.api(url, method, tenant, headers, data, callback);
                }
            );
        }
        return UI.api(url, method, tenant, headers, data, callback);
    }

    showFieldError(false);

    UI.onEvent(function (type) {
        if (type === "updateEntity") {
            showFieldError(false);
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
