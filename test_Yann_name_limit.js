/**
 * test_Yann only: after a Name write fails DVF, reshape the API error so Hub
 * paints the message on the Name field (validationErrors / INCORRECT) instead
 * of only the profile summary banner.
 */
(function () {
    var MAX_LEN = 10;
    var ENTITY_TYPE = "configuration/entityTypes/test_Yann";
    var NAME_TYPE = ENTITY_TYPE + "/attributes/Name";
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

    function nameUriOf(entity) {
        var values = entity && entity.attributes && entity.attributes.Name;
        if (values && values[0] && values[0].uri) {
            return values[0].uri;
        }
        return null;
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

    function dvfMessage(block) {
        var errors = block && (block.errors || block.error);
        if (!errors) {
            return "";
        }
        var inner = errors.innerErrorData;
        if (inner && inner.length && inner[0]) {
            return String(inner[0].validationMessage || inner[0].message || inner[0].errorMessage || "");
        }
        return String(errors.errorMessage || errors.errorDetailMessage || "");
    }

    function isDvfFailure(block) {
        var errors = block && (block.errors || block.error);
        if (!errors) {
            return false;
        }
        if (String(errors.errorCode) === "31010") {
            return true;
        }
        var text = dvfMessage(block).toLowerCase();
        return text.indexOf("dvf") !== -1 || text.indexOf("10 character") !== -1;
    }

    function fieldError(entity, message) {
        return {
            severity: "ERROR",
            errorType: "INCORRECT",
            objectParentUri: ENTITY_TYPE,
            objectTypeUri: NAME_TYPE,
            objectUri: nameUriOf(entity),
            message: message || LIMIT_MESSAGE
        };
    }

    function asFieldResult(entity, message) {
        var result = {
            successful: false,
            validationErrors: [fieldError(entity, message)]
        };
        if (entity) {
            result.object = entity;
        }
        return result;
    }

    function rewriteBlock(block, entity) {
        if (!block || block.successful !== false) {
            return block;
        }
        if (!isDvfFailure(block) && !(block.validationErrors && block.validationErrors.length)) {
            return block;
        }
        var message = dvfMessage(block) || LIMIT_MESSAGE;
        if (block.validationErrors && block.validationErrors.length) {
            return block;
        }
        return asFieldResult(entity, message);
    }

    function rewriteResponse(json, payload) {
        var entity = firstEntity(payload);
        if (Array.isArray(json)) {
            return json.map(function (block) {
                var fromBlock = block && block.object;
                return rewriteBlock(block, fromBlock && fromBlock.type ? fromBlock : entity);
            });
        }
        return rewriteBlock(json, entity);
    }

    function send(callback, result, status, respHeaders) {
        if (typeof callback === "function") {
            callback(result, status, respHeaders);
        }
        return result;
    }

    function callApi(url, method, tenant, headers, data, onDone) {
        var done = false;
        var finish = function (json, status, respHeaders) {
            if (done) {
                return;
            }
            done = true;
            onDone(json, status, respHeaders);
        };
        var pending = UI.api(url, method, tenant, headers, data, finish);
        if (pending && typeof pending.then === "function") {
            pending.then(
                function (json) {
                    finish(json, 200, {});
                },
                function (err) {
                    finish(err, 400, {});
                }
            );
        }
        return pending;
    }

    function forwardWrite(url, method, tenant, headers, data, callback) {
        var parsed = parseData(data);
        return callApi(url, method, tenant, headers, data, function (json, status, respHeaders) {
            var entity = firstEntity(parsed);
            var out = rewriteResponse(json, parsed);
            if (status >= 300 && payloadNameTooLong(parsed)) {
                out = Array.isArray(json) ? [asFieldResult(entity)] : asFieldResult(entity);
            }
            send(callback, out, status, respHeaders);
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
        if (!isWrite(verb)) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        var parsed = parseData(data);
        if (isTestYann(firstEntity(parsed)) || payloadNameTooLong(parsed)) {
            return forwardWrite(url, verb, tenant, headers, data, callback);
        }
        return UI.getEntity().then(
            function (entity) {
                if (!isTestYann(entity)) {
                    return UI.api(url, verb, tenant, headers, data, callback);
                }
                return forwardWrite(url, verb, tenant, headers, data, callback);
            },
            function () {
                return UI.api(url, verb, tenant, headers, data, callback);
            }
        );
    });
})();
