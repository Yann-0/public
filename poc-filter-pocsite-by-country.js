/**
 * POC: typeahead for [POC] Site must only list sites of the participating country
 * currently being edited (Albania must not offer an Angola site).
 *
 * Hub sends _typeAheadSearch / _search for configuration/entityTypes/POCSite.
 * This script injects equals(attributes.CountryCode, '<lookupCode>').
 */
(function () {
    var SITE_TYPE = "configuration/entityTypes/POCSite";
    var COUNTRY_FILTER = "equals(attributes.CountryCode,";

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

    function isSiteSearch(url, parsed) {
        if (!/\/entities(\/_|\/?\?)/.test(url) && !/_typeAheadSearch|_search/.test(url)) {
            return false;
        }
        var blob = url + JSON.stringify(parsed || {});
        return blob.indexOf(SITE_TYPE) !== -1 || blob.indexOf("POCSite") !== -1;
    }

    function lookupCodeFrom(obj) {
        if (!obj || typeof obj !== "object") {
            return "";
        }
        if (obj.lookupCode) {
            return String(obj.lookupCode);
        }
        if (obj.value && typeof obj.value === "object" && obj.value.lookupCode) {
            return String(obj.value.lookupCode);
        }
        return "";
    }

    function firstLookup(arr) {
        if (!Array.isArray(arr) || !arr.length) {
            return "";
        }
        return lookupCodeFrom(arr[0]) || (arr[0].value != null && typeof arr[0].value !== "object" ? "" : lookupCodeFrom(arr[0]));
    }

    function countryFromNested(nested) {
        if (!nested) {
            return "";
        }
        var val = nested.value || nested;
        if (val.ParticipatingCountryCode) {
            var code = firstLookup(val.ParticipatingCountryCode);
            if (code) {
                return code;
            }
            if (Array.isArray(val.ParticipatingCountryCode) && val.ParticipatingCountryCode[0] && val.ParticipatingCountryCode[0].lookupCode) {
                return String(val.ParticipatingCountryCode[0].lookupCode);
            }
        }
        return lookupCodeFrom(nested) || lookupCodeFrom(val);
    }

    function countryFromRequest(url, parsed, rawParams) {
        var bag = [];
        if (rawParams && typeof rawParams === "object") {
            bag.push(rawParams);
        }
        if (parsed && typeof parsed === "object") {
            bag.push(parsed);
        }
        for (var i = 0; i < bag.length; i++) {
            var o = bag[i];
            var keys = ["parent", "parentValue", "parentAttributeValue", "context", "attributeValue", "nestedValue", "value"];
            for (var k = 0; k < keys.length; k++) {
                var code = countryFromNested(o[keys[k]]);
                if (code) {
                    return code;
                }
            }
            if (o.ParticipatingCountryCode) {
                var nestedCode = firstLookup(o.ParticipatingCountryCode);
                if (nestedCode) {
                    return nestedCode;
                }
            }
        }
        var m = String(url || "").match(/ParticipatingCountryCode[^A-Z]*([A-Z]{2,3})/i);
        if (m) {
            return m[1].toUpperCase();
        }
        return "";
    }

    function countriesFromEntity(entity) {
        var out = [];
        var rows = entity && entity.attributes && entity.attributes.ParticipatingCountry;
        if (!Array.isArray(rows)) {
            return out;
        }
        for (var i = 0; i < rows.length; i++) {
            var code = countryFromNested(rows[i]);
            if (code && out.indexOf(code) === -1) {
                out.push(code);
            }
        }
        return out;
    }

    function injectFilter(filter, code) {
        if (!code) {
            return filter;
        }
        var clause = COUNTRY_FILTER + " '" + code + "')";
        if (String(filter || "").indexOf("attributes.CountryCode") !== -1) {
            return filter;
        }
        if (!filter) {
            return "(equals(type,'" + SITE_TYPE + "') and " + clause + ")";
        }
        return "(" + filter + " and " + clause + ")";
    }

    function rewriteUrl(url, code) {
        if (!code || url.indexOf("attributes.CountryCode") !== -1) {
            return url;
        }
        var clause = encodeURIComponent(" and " + COUNTRY_FILTER + " '" + code + "')");
        if (/([?&])filter=/.test(url)) {
            return url.replace(/([?&]filter=)([^&]*)/, function (all, p1, p2) {
                var decoded = decodeURIComponent(p2);
                var next = injectFilter(decoded, code);
                if (next.charAt(0) === "(" && next.charAt(next.length - 1) === ")") {
                    next = next.slice(1, -1);
                }
                return p1 + encodeURIComponent(next);
            });
        }
        var sep = url.indexOf("?") >= 0 ? "&" : "?";
        return url + sep + "filter=" + encodeURIComponent("(equals(type,'" + SITE_TYPE + "') and " + COUNTRY_FILTER + " '" + code + "'))");
    }

    function rewriteBody(parsed, code) {
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return parsed;
        }
        var copy = {};
        for (var k in parsed) {
            if (Object.prototype.hasOwnProperty.call(parsed, k)) {
                copy[k] = parsed[k];
            }
        }
        copy.filter = injectFilter(parsed.filter, code);
        return copy;
    }

    function pickCountry(url, parsed, rawParams, entity) {
        var fromReq = countryFromRequest(url, parsed, rawParams);
        if (fromReq) {
            return fromReq;
        }
        var fromEntity = countriesFromEntity(entity);
        if (fromEntity.length === 1) {
            return fromEntity[0];
        }
        return "";
    }

    function send(callback, result, status, headers) {
        if (typeof callback === "function") {
            callback(result, status, headers);
        }
        return result;
    }

    UI.onApiRequest(function (urlOrParams, method, headers, data, callback) {
        var url = urlOf(urlOrParams);
        var tenant;
        var parsed = parseData(data);
        if (urlOrParams && typeof urlOrParams === "object") {
            headers = urlOrParams.headers || headers;
            data = urlOrParams.data;
            parsed = parseData(data);
            tenant = urlOrParams.tenant;
        }
        var verb = methodOf(urlOrParams, method);
        if (!isSiteSearch(url, parsed)) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }

        function apply(entity) {
            var code = pickCountry(url, parsed, urlOrParams, entity);
            if (!code) {
                return UI.api(url, verb, tenant, headers, data, callback);
            }
            var nextUrl = rewriteUrl(url, code);
            var nextData = data;
            if (verb === "POST" || verb === "PUT" || verb === "PATCH") {
                var rewritten = rewriteBody(parsed, code);
                nextData = typeof data === "string" ? JSON.stringify(rewritten) : rewritten;
            }
            return UI.api(nextUrl, verb, tenant, headers, nextData, callback);
        }

        return UI.getEntity().then(
            function (entity) {
                return apply(entity);
            },
            function () {
                return apply(null);
            }
        );
    });
})();
