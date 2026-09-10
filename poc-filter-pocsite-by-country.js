/**
 * POC Hub: [POC] Site typeahead and Study save.
 *
 * A site belongs to one country. Under a participating country row, the picker
 * must only list sites of THAT country (Algeria must not offer an Angola site).
 *
 * Hub does not reliably substitute nested RDM placeholders, and a lookup filter
 * must use the lookup code (DZ), not the label (Algeria). This script:
 * 1) runs in the profile worker (all /entities* requests)
 * 2) injects equals(attributes.CountryCode, '<ISO code>') on POCSite typeahead
 * 3) rejects Study saves that link a site of another country
 */
(function () {
    var SITE_TYPE = "configuration/entityTypes/POCSite";
    var STUDY_TYPE = "configuration/entityTypes/POCStudy";
    var TEST_YANN = "configuration/entityTypes/test_Yann";
    var MAX_LEN = 10;
    var COUNTRY_EQUALS_RE = /equals\(\s*attributes\.CountryCode\s*,\s*(?:'[^']*'|\{[^}]*\})\s*\)/g;

    var lastEntity = null;
    var activeCountryCode = "";

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

    function isSiteSearch(url, parsed) {
        var u = String(url || "");
        if (
            !/\/entities\/_typeAheadSearch(?:[/?]|$)/.test(u) &&
            !/\/entities\/_search(?:[/?]|$)/.test(u)
        ) {
            return false;
        }
        var blob = u + JSON.stringify(parsed || {});
        return blob.indexOf(SITE_TYPE) !== -1 || blob.indexOf("POCSite") !== -1;
    }

    function lookupCodeFrom(obj) {
        if (obj == null) {
            return "";
        }
        if (typeof obj === "string") {
            return /^[A-Z]{2,3}$/.test(obj) ? obj : "";
        }
        if (typeof obj !== "object") {
            return "";
        }
        if (obj.lookupCode) {
            return String(obj.lookupCode);
        }
        if (obj.lookupRawValue && /^[A-Z0-9]{2,5}$/.test(String(obj.lookupRawValue))) {
            return String(obj.lookupRawValue);
        }
        if (obj.value && typeof obj.value === "object") {
            return lookupCodeFrom(obj.value);
        }
        if (typeof obj.value === "string" && /^[A-Z]{2,3}$/.test(obj.value)) {
            return obj.value;
        }
        return "";
    }

    function lookupLabelFrom(obj) {
        if (!obj || typeof obj !== "object") {
            return "";
        }
        if (obj.lookupValue) {
            return String(obj.lookupValue);
        }
        if (typeof obj.value === "string" && !/^[A-Z]{2,3}$/.test(obj.value)) {
            return obj.value;
        }
        if (obj.value && typeof obj.value === "object") {
            return lookupLabelFrom(obj.value);
        }
        return "";
    }

    function firstLookup(arr) {
        if (!Array.isArray(arr) || !arr.length) {
            return "";
        }
        return lookupCodeFrom(arr[0]);
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
        }
        if (val.CountryCode) {
            var siteCode = firstLookup(val.CountryCode);
            if (siteCode) {
                return siteCode;
            }
        }
        return lookupCodeFrom(nested) || lookupCodeFrom(val);
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

    function codeFromLabel(label, entity) {
        if (!label) {
            return "";
        }
        var want = String(label).toLowerCase();
        var rows = entity && entity.attributes && entity.attributes.ParticipatingCountry;
        if (!Array.isArray(rows)) {
            return "";
        }
        for (var i = 0; i < rows.length; i++) {
            var val = rows[i].value || rows[i];
            var arr = val.ParticipatingCountryCode;
            if (!Array.isArray(arr) || !arr[0]) {
                continue;
            }
            var rowLabel = lookupLabelFrom(arr[0]).toLowerCase();
            var rowVal = typeof arr[0].value === "string" ? String(arr[0].value).toLowerCase() : "";
            if (rowLabel === want || rowVal === want) {
                return lookupCodeFrom(arr[0]);
            }
        }
        return "";
    }

    function extractCode(node, entity) {
        var code = lookupCodeFrom(node);
        if (code) {
            return code;
        }
        var label = lookupLabelFrom(node);
        if (label) {
            return codeFromLabel(label, entity || lastEntity);
        }
        if (typeof node === "string") {
            if (/^[A-Z]{2,3}$/.test(node)) {
                return node;
            }
            return codeFromLabel(node, entity || lastEntity);
        }
        return "";
    }

    function walkExtract(node, entity, depth) {
        if (!node || depth > 6) {
            return "";
        }
        var direct = extractCode(node, entity);
        if (direct) {
            return direct;
        }
        if (typeof node !== "object") {
            return "";
        }
        var keys = [
            "ParticipatingCountryCode",
            "CountryCode",
            "parent",
            "parentValue",
            "parentAttributeValue",
            "context",
            "attributeValue",
            "nestedValue",
            "value",
            "lookupCode"
        ];
        for (var i = 0; i < keys.length; i++) {
            if (node[keys[i]] != null) {
                var found = walkExtract(node[keys[i]], entity, depth + 1);
                if (found) {
                    return found;
                }
            }
        }
        return "";
    }

    function countryFromRequest(url, parsed, rawParams, entity) {
        var bag = [];
        if (rawParams && typeof rawParams === "object") {
            bag.push(rawParams);
        }
        if (parsed && typeof parsed === "object") {
            bag.push(parsed);
        }
        for (var i = 0; i < bag.length; i++) {
            var code = walkExtract(bag[i], entity, 0);
            if (code) {
                return code;
            }
        }
        var filter = String((parsed && parsed.filter) || url || "");
        var placeholder = filter.match(/\{([^}]+)\}/);
        if (placeholder && placeholder[1] && placeholder[1].indexOf("ParticipatingCountry") === -1) {
            var inner = extractCode(placeholder[1], entity);
            if (inner) {
                return inner;
            }
        }
        var quoted = filter.match(/equals\(\s*attributes\.CountryCode\s*,\s*'([^']*)'\s*\)/);
        if (quoted && quoted[1] && quoted[1].indexOf("{") === -1) {
            var fromQuoted = extractCode(quoted[1], entity);
            if (fromQuoted) {
                return fromQuoted;
            }
        }
        return "";
    }

    function pickCountry(url, parsed, rawParams, entity) {
        var fromReq = countryFromRequest(url, parsed, rawParams, entity);
        if (fromReq) {
            return fromReq;
        }
        if (activeCountryCode) {
            return activeCountryCode;
        }
        var fromEntity = countriesFromEntity(entity || lastEntity);
        if (fromEntity.length === 1) {
            return fromEntity[0];
        }
        return "";
    }

    function injectFilter(filter, code) {
        if (!code) {
            return filter;
        }
        var clause = "equals(attributes.CountryCode, '" + code + "')";
        var f = String(filter || "");
        var replaced = f.replace(COUNTRY_EQUALS_RE, clause);
        if (replaced !== f) {
            return replaced;
        }
        if (!f) {
            return "(equals(type,'" + SITE_TYPE + "') and " + clause + ")";
        }
        return "(" + f + " and " + clause + ")";
    }

    function rewriteUrl(url, code) {
        if (!code) {
            return url;
        }
        if (/([?&])filter=/.test(url)) {
            return url.replace(/([?&]filter=)([^&]*)/, function (all, p1, p2) {
                var decoded = decodeURIComponent(p2);
                return p1 + encodeURIComponent(injectFilter(decoded, code));
            });
        }
        var sep = url.indexOf("?") >= 0 ? "&" : "?";
        return url + sep + "filter=" + encodeURIComponent("(equals(type,'" + SITE_TYPE + "') and equals(attributes.CountryCode, '" + code + "'))");
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

    function rememberEntity(entity) {
        if (!entity || !entity.attributes) {
            return;
        }
        lastEntity = entity;
        var codes = countriesFromEntity(entity);
        if (codes.length === 1) {
            activeCountryCode = codes[0];
        }
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

    function siteCountryFromLink(link) {
        if (!link) {
            return "";
        }
        var val = link.value || link;
        var attrs =
            (val.attributes && val.attributes.CountryCode) ||
            (link.attributes && link.attributes.CountryCode) ||
            (val.refEntity && val.refEntity.attributes && val.refEntity.attributes.CountryCode) ||
            (link.refEntity && link.refEntity.attributes && link.refEntity.attributes.CountryCode);
        if (attrs) {
            var code = firstLookup(Array.isArray(attrs) ? attrs : [attrs]);
            if (code) {
                return code;
            }
            return lookupCodeFrom(attrs);
        }
        return countryFromNested(link);
    }

    function linkedSiteUri(link) {
        var val = (link && link.value) || link || {};
        return (
            val.entityId ||
            val.objectURI ||
            (val.refEntity && (val.refEntity.objectURI || val.refEntity.uri)) ||
            (link.refEntity && (link.refEntity.objectURI || link.refEntity.uri)) ||
            ""
        );
    }

    function mismatchMessage(countryCode) {
        return "A [POC] Site must belong to this participating country (" + countryCode + "). Pick a site of that country only.";
    }

    function blockSave(callback, message) {
        if (typeof callback === "function") {
            callback(
                {
                    errorCode: 400,
                    errorMessage: message,
                    error: message
                },
                400,
                {}
            );
        }
        return null;
    }

    function validateStudySites(parsed) {
        var entity = firstEntity(parsed);
        if (!entity || entity.type !== STUDY_TYPE) {
            return "";
        }
        var rows = entity.attributes && entity.attributes.ParticipatingCountry;
        if (!Array.isArray(rows)) {
            return "";
        }
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i].value || rows[i];
            var country = countryFromNested(rows[i]);
            if (!country) {
                continue;
            }
            var links = row.LinkedSite;
            if (!Array.isArray(links)) {
                continue;
            }
            for (var j = 0; j < links.length; j++) {
                var siteCountry = siteCountryFromLink(links[j]);
                if (siteCountry && siteCountry !== country) {
                    return mismatchMessage(country);
                }
            }
        }
        return "";
    }

    function stampSiteCountry(parsed, code) {
        if (!parsed || !code) {
            return parsed;
        }
        var entity = firstEntity(parsed);
        if (!entity || entity.type !== SITE_TYPE) {
            return parsed;
        }
        entity.attributes = entity.attributes || {};
        if (firstLookup(entity.attributes.CountryCode)) {
            return parsed;
        }
        entity.attributes.CountryCode = [
            {
                value: code,
                lookupCode: code
            }
        ];
        return parsed;
    }

    function applyTypeahead(url, verb, tenant, headers, data, parsed, urlOrParams, entity, callback) {
        var code = pickCountry(url, parsed, urlOrParams, entity);
        var filterCode = code || "__COUNTRY_REQUIRED__";
        var nextUrl = rewriteUrl(url, filterCode);
        var nextData = data;
        if (verb === "POST" || verb === "PUT" || verb === "PATCH") {
            var rewritten = rewriteBody(parsed || {}, filterCode);
            nextData = typeof data === "string" ? JSON.stringify(rewritten) : rewritten;
        }
        return UI.api(nextUrl, verb, tenant, headers, nextData, callback);
    }

    function nameValueTooLong(value) {
        return value != null && String(value).length > MAX_LEN;
    }

    function isTestYann(entity) {
        return !!(entity && entity.type === TEST_YANN);
    }

    function payloadNameTooLong(payload) {
        if (!payload || typeof payload !== "object") {
            return false;
        }
        var entity = firstEntity(payload);
        if (!isTestYann(entity)) {
            return false;
        }
        var name = entity.attributes && entity.attributes.Name;
        if (name == null) {
            return false;
        }
        if (typeof name === "string") {
            return nameValueTooLong(name);
        }
        if (Array.isArray(name) && name[0] && name[0].value != null) {
            return nameValueTooLong(name[0].value);
        }
        if (name.value != null) {
            return nameValueTooLong(name.value);
        }
        return false;
    }

    function handleTestYannWrite(url, method, tenant, headers, data, parsed, callback) {
        var entity = firstEntity(parsed);
        if (isTestYann(entity) && payloadNameTooLong(parsed)) {
            if (typeof callback === "function") {
                callback([{ successful: false }], 200, {});
            }
            return null;
        }
        return UI.api(url, method, tenant, headers, data, callback);
    }

    try {
        UI.getEntity().then(rememberEntity, function () {});
    } catch (e) {
        /* sandbox */
    }

    UI.onEvent(function (type, data) {
        if (type === "updateEntity") {
            rememberEntity(data);
            var fromUpdate = walkExtract(data, data, 0);
            if (fromUpdate) {
                activeCountryCode = fromUpdate;
            }
            return;
        }
        if (type === "uiAction") {
            var code = walkExtract(data, lastEntity, 0);
            if (code) {
                activeCountryCode = code;
            }
        }
    });

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

        try {
            if (isSiteSearch(url, parsed)) {
                return UI.getEntity().then(
                    function (entity) {
                        rememberEntity(entity);
                        return applyTypeahead(url, verb, tenant, headers, data, parsed, urlOrParams, entity, callback);
                    },
                    function () {
                        return applyTypeahead(url, verb, tenant, headers, data, parsed, urlOrParams, lastEntity, callback);
                    }
                );
            }

            if (isWrite(verb)) {
                var studyError = validateStudySites(parsed);
                if (studyError) {
                    return blockSave(callback, studyError);
                }
                var written = firstEntity(parsed);
                if (written && written.type === SITE_TYPE && lastEntity && lastEntity.type === STUDY_TYPE) {
                    var stampCode = activeCountryCode || pickCountry(url, parsed, urlOrParams, lastEntity);
                    parsed = stampSiteCountry(parsed, stampCode);
                    data = typeof data === "string" ? JSON.stringify(parsed) : parsed;
                }
                return handleTestYannWrite(url, verb, tenant, headers, data, parsed, callback);
            }

            return UI.api(url, verb, tenant, headers, data, callback);
        } catch (err) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
    });
})();
