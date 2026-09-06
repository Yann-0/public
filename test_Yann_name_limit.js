/**
 * test_Yann only: intercept entity writes. If Name is longer than 10,
 * show a Hub alert and do not send the request.
 */
(function () {
    var MAX_LEN = 10;
    var ENTITY_TYPE = "configuration/entityTypes/test_Yann";
    var LIMIT_MESSAGE = "Name is limited to 10 characters.";

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

    function isNameAttributeUrl(url) {
        return /\/attributes\/Name(?:\/|\?|$)/.test(url) && /\/entities\//.test(url);
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

    function entityNameTooLong(entity, assumeTestYann) {
        if (!assumeTestYann && !isTestYann(entity)) {
            return false;
        }
        return !!(entity && entity.attributes && nameValuesTooLong(entity.attributes.Name));
    }

    function payloadNameTooLong(payload, assumeTestYann) {
        if (payload == null) {
            return false;
        }
        if (Array.isArray(payload)) {
            for (var i = 0; i < payload.length; i++) {
                if (entityNameTooLong(payload[i], assumeTestYann)) {
                    return true;
                }
            }
            return false;
        }
        if (typeof payload !== "object") {
            return false;
        }
        if (payload.attributes || payload.type) {
            return entityNameTooLong(payload, assumeTestYann);
        }
        return payload.value != null && String(payload.value).length > MAX_LEN;
    }

    function blockedResult() {
        return [
            {
                successful: false,
                errors: {
                    severity: "Error",
                    errorMessage: LIMIT_MESSAGE,
                    errorCode: 31010
                }
            }
        ];
    }

    function blockAfterAlert() {
        return Promise.resolve()
            .then(function () {
                try {
                    var pending = UI.alert(LIMIT_MESSAGE);
                    if (pending && typeof pending.then === "function") {
                        return pending;
                    }
                } catch (e) {
                    /* ignore */
                }
                return undefined;
            })
            .then(
                function () {
                    return Promise.reject(blockedResult());
                },
                function () {
                    return Promise.reject(blockedResult());
                }
            );
    }

    function applyWrite(url, method, tenant, headers, data) {
        var parsed = parseData(data);
        if (payloadNameTooLong(parsed, false)) {
            return blockAfterAlert();
        }
        var maybeNameWrite =
            isNameAttributeUrl(url) || (parsed && parsed.attributes && parsed.attributes.Name);
        if (!maybeNameWrite) {
            return UI.api(url, method, tenant, headers, data);
        }
        if (isTestYann(parsed) || (Array.isArray(parsed) && parsed.some(isTestYann))) {
            if (payloadNameTooLong(parsed, true)) {
                return blockAfterAlert();
            }
            return UI.api(url, method, tenant, headers, data);
        }
        return UI.getEntity().then(function (entity) {
            if (!isTestYann(entity)) {
                return UI.api(url, method, tenant, headers, data);
            }
            if (payloadNameTooLong(parsed, true)) {
                return blockAfterAlert();
            }
            return UI.api(url, method, tenant, headers, data);
        });
    }

    UI.onApiRequest(function (urlOrParams, method, headers, data, callback) {
        var url = urlOf(urlOrParams);
        var tenant;
        if (urlOrParams && typeof urlOrParams === "object") {
            headers = urlOrParams.headers || headers;
            data = urlOrParams.data;
            tenant = urlOrParams.tenant;
        }
        var verb = methodOf(urlOrParams, method);
        var send = function (result) {
            if (typeof callback === "function") {
                if (result && typeof result.then === "function") {
                    return result.then(
                        function (json) {
                            callback(json);
                        },
                        function (err) {
                            callback(err || blockedResult(), 400, {});
                        }
                    );
                }
                return callback(result);
            }
            return result;
        };
        if (!isWrite(verb)) {
            return send(UI.api(url, verb, tenant, headers, data));
        }
        return send(applyWrite(url, verb, tenant, headers, data));
    });
})();
