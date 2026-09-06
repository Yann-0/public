/**
 * test_Yann only: block Name longer than 10 characters and show the message
 * in the Custom facet under Name. Do not return DVF/validationErrors — Hub nui
 * paints those in the profile "1 error" banner.
 */
(function () {
    var MAX_LEN = 10;
    var ENTITY_TYPE = "configuration/entityTypes/test_Yann";
    var LIMIT_MESSAGE = "Name must be 10 characters or fewer.";
    var ERROR_HTML =
        '<div style="font-family:Roboto,Helvetica,Arial,sans-serif;color:#d32f2f;font-size:12px;line-height:16px;padding:4px 16px 12px;">' +
        LIMIT_MESSAGE +
        "</div>";

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

    function isDvfFailure(json) {
        var blocks = Array.isArray(json) ? json : [json];
        for (var i = 0; i < blocks.length; i++) {
            var errors = blocks[i] && (blocks[i].errors || blocks[i].error);
            if (errors && String(errors.errorCode) === "31010") {
                return true;
            }
            var text = JSON.stringify(errors || {}).toLowerCase();
            if (text.indexOf("10 character") !== -1 || text.indexOf("dvf") !== -1) {
                return true;
            }
        }
        return false;
    }

    function showFieldError(show) {
        try {
            UI.setVisibility("visible");
            UI.setHtml(show ? ERROR_HTML : "");
            UI.setHeight(show ? 44 : 8);
        } catch (e) {
            /* customScripts sandbox has no Custom view */
        }
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
        showFieldError(true);
        return send(callback, blockedBody(), 200, {});
    }

    function stripBanner(json) {
        var blocks = Array.isArray(json) ? json : [json];
        var out = blocks.map(function (block) {
            if (!block || block.successful !== false) {
                return block;
            }
            return { successful: false };
        });
        return Array.isArray(json) ? out : out[0];
    }

    function handleWrite(url, method, tenant, headers, data, callback) {
        var parsed = parseData(data);
        var run = function (tooLong) {
            if (tooLong) {
                return block(callback);
            }
            return UI.api(url, method, tenant, headers, data, function (json, status, respHeaders) {
                if (isDvfFailure(json) || (status >= 300 && payloadNameTooLong(parsed))) {
                    showFieldError(true);
                    return send(callback, stripBanner(json) || blockedBody(), 200, respHeaders || {});
                }
                showFieldError(false);
                return send(callback, json, status, respHeaders);
            });
        };
        if (isTestYann(firstEntity(parsed))) {
            return run(payloadNameTooLong(parsed));
        }
        if (payloadNameTooLong(parsed) || /\/attributes\/Name(?:\/|\?|$)/.test(url) || /\/entities/.test(url)) {
            return UI.getEntity().then(
                function (entity) {
                    if (!isTestYann(entity)) {
                        return UI.api(url, method, tenant, headers, data, callback);
                    }
                    return run(payloadNameTooLong(parsed));
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
