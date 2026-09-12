/**
 * POC Hub: [POC] Site picker is scoped to the participating country.
 *
 * Hub typeahead for an inline Reference is often GET /entities?filter=...,
 * not _typeAheadSearch. Results are filtered by the country of the current row
 * (label already contains the country, e.g. "a siite (Angola)").
 */
(function () {
    var SITE_TYPE = "configuration/entityTypes/POCSite";
    var STUDY_TYPE = "configuration/entityTypes/POCStudy";
    var COUNTRY_TYPE = "configuration/entityTypes/POCParticipatingCountry";
    var COUNTRY_EQUALS_RE = /equals\(\s*attributes\.CountryCode\s*,\s*(?:'[^']*'|\{[^}]*\})\s*\)/g;

    var lastEntity = null;
    var draftCountry = { code: "", label: "" };
    var lastStudyId = "";

    var ISO_BY_NAME = {
        afghanistan: "AF", albania: "AL", algeria: "DZ", angola: "AO",
        argentina: "AR", australia: "AU", austria: "AT", belgium: "BE",
        brazil: "BR", bulgaria: "BG", canada: "CA", china: "CN",
        croatia: "HR", czechia: "CZ", denmark: "DK", egypt: "EG",
        estonia: "EE", finland: "FI", france: "FR", germany: "DE",
        greece: "GR", hungary: "HU", iceland: "IS", india: "IN",
        indonesia: "ID", ireland: "IE", israel: "IL", italy: "IT",
        japan: "JP", latvia: "LV", lithuania: "LT", luxembourg: "LU",
        mexico: "MX", morocco: "MA", netherlands: "NL", "new zealand": "NZ",
        nigeria: "NG", norway: "NO", poland: "PL", portugal: "PT",
        romania: "RO", russia: "RU", "saudi arabia": "SA", serbia: "RS",
        singapore: "SG", slovakia: "SK", slovenia: "SI", "south africa": "ZA",
        "south korea": "KR", spain: "ES", sweden: "SE", switzerland: "CH",
        tunisia: "TN", turkey: "TR", turkiye: "TR", ukraine: "UA",
        "united arab emirates": "AE", "united kingdom": "GB",
        "united states": "US", "united states of america": "US"
    };

    function isoFromLabel(label) {
        if (!label) {
            return "";
        }
        return ISO_BY_NAME[String(label).toLowerCase().replace(/^\s+|\s+$/g, "")] || "";
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

    function quoteLookup(value) {
        return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    }

    function lookupCodeFrom(obj) {
        if (obj == null) {
            return "";
        }
        if (typeof obj === "string") {
            return /^[A-Z]{2,3}$/.test(obj) ? obj : isoFromLabel(obj);
        }
        if (typeof obj !== "object") {
            return "";
        }
        if (obj.lookupCode) {
            return String(obj.lookupCode);
        }
        if (obj.value && typeof obj.value === "object") {
            return lookupCodeFrom(obj.value);
        }
        if (typeof obj.value === "string") {
            return /^[A-Z]{2,3}$/.test(obj.value) ? obj.value : isoFromLabel(obj.value);
        }
        if (obj.lookupValue) {
            return isoFromLabel(obj.lookupValue);
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

    function firstOf(arr, fn) {
        if (!Array.isArray(arr) || !arr.length) {
            return "";
        }
        return fn(arr[0]);
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
            }
            return payload[0] || null;
        }
        return payload.object && payload.object.type ? payload.object : payload;
    }

    function attrText(attr) {
        if (attr == null) {
            return "";
        }
        if (typeof attr === "string") {
            return attr;
        }
        if (Array.isArray(attr)) {
            return attrText(attr[0]);
        }
        if (typeof attr === "object" && attr.value != null && typeof attr.value !== "object") {
            return String(attr.value);
        }
        return "";
    }

    function foundOrDraft(found) {
        return {
            code: found.code || isoFromLabel(found.label),
            label: found.label
        };
    }

    function countryFromEntity(entity) {
        if (!entity || !entity.attributes) {
            return { code: "", label: "" };
        }
        var arr = entity.attributes.ParticipatingCountryCode || entity.attributes.CountryCode;
        return {
            code: firstOf(arr, lookupCodeFrom) || isoFromLabel(firstOf(arr, lookupLabelFrom)),
            label: firstOf(arr, lookupLabelFrom)
        };
    }

    function findCountryDeep(node, depth) {
        if (!node || depth > 8 || typeof node !== "object") {
            return { code: "", label: "" };
        }
        if (node.ParticipatingCountryCode) {
            var arr = node.ParticipatingCountryCode;
            return {
                code: firstOf(arr, lookupCodeFrom) || isoFromLabel(firstOf(arr, lookupLabelFrom)),
                label: firstOf(arr, lookupLabelFrom)
            };
        }
        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i++) {
                var found = findCountryDeep(node[i], depth + 1);
                if (found.code || found.label) {
                    return found;
                }
            }
            return { code: "", label: "" };
        }
        var skip = { filter: 1, select: 1, Sites: 1, LinkedSite: 1 };
        for (var k in node) {
            if (!Object.prototype.hasOwnProperty.call(node, k) || skip[k]) {
                continue;
            }
            var nested = findCountryDeep(node[k], depth + 1);
            if (nested.code || nested.label) {
                return nested;
            }
        }
        return { code: "", label: "" };
    }

    function rememberEntity(entity) {
        if (!entity) {
            return;
        }
        var cand = entity.object && entity.object.type ? entity.object : entity;
        if (!cand.type || cand.type === SITE_TYPE) {
            return;
        }
        lastEntity = cand;
        if (cand.type === STUDY_TYPE) {
            lastStudyId = attrText(cand.attributes && cand.attributes.StudyId) || lastStudyId;
            var fromStudy = findCountryDeep(cand, 0);
            if (fromStudy.code || fromStudy.label) {
                draftCountry = foundOrDraft(fromStudy);
            }
        }
        if (cand.type === COUNTRY_TYPE) {
            var found = countryFromEntity(cand);
            if (found.code || found.label) {
                draftCountry = found;
            }
        }
    }

    function rememberDraftCountry(node) {
        if (node == null) {
            return;
        }
        var label = lookupLabelFrom(node);
        if (!label && typeof node === "string") {
            label = node;
        }
        var code = lookupCodeFrom(node) || isoFromLabel(label);
        if (!code && !label) {
            return;
        }
        draftCountry = { code: code || isoFromLabel(label), label: label };
    }

    function selectedCountry(entity) {
        var e = entity || lastEntity;
        var fromEntity = countryFromEntity(e);
        if (!fromEntity.code && !fromEntity.label) {
            fromEntity = findCountryDeep(e, 0);
        }
        if (fromEntity.code || fromEntity.label) {
            return foundOrDraft(fromEntity);
        }
        return {
            code: draftCountry.code || isoFromLabel(draftCountry.label),
            label: draftCountry.label
        };
    }

    function countryClause(code, label) {
        var parts = [];
        function add(v) {
            if (!v) {
                return;
            }
            var c = "equals(attributes.CountryCode, '" + quoteLookup(v) + "')";
            if (parts.indexOf(c) === -1) {
                parts.push(c);
            }
        }
        add(code);
        if (label && label !== code) {
            add(label);
        }
        if (!parts.length) {
            return "";
        }
        if (parts.length === 1) {
            return parts[0];
        }
        return "(" + parts.join(" or ") + ")";
    }

    function isSingleEntityGet(url) {
        return /\/entities\/[A-Za-z0-9._=-]+(?:\?|$)/.test(String(url || ""));
    }

    function isTypeaheadUrl(url) {
        var u = String(url || "");
        if (isSingleEntityGet(u) && u.indexOf("_typeAhead") === -1) {
            return false;
        }
        return (
            /\/entities\/_typeAheadSearch(?:[/?]|$)/.test(u) ||
            /\/entities\/_search(?:[/?]|$)/.test(u) ||
            /\/entities\/_suggest(?:[/?]|$)/.test(u) ||
            /\/entities\/_scan(?:[/?]|$)/.test(u) ||
            /\/entities\?/.test(u)
        );
    }

    function isSiteSearch(url, parsed, rawParams) {
        var blob = String(url || "") + JSON.stringify(parsed || {});
        if (rawParams && typeof rawParams === "object") {
            blob += JSON.stringify(rawParams.type || rawParams.entityType || "");
        }
        if (
            /entityTypes\/(HCP|HCO|Location|Individual|POCInvestigator|POCStudy|POCParticipatingCountry)\b/.test(blob) &&
            blob.indexOf("POCSite") === -1
        ) {
            return false;
        }
        var looksSite = blob.indexOf("POCSite") !== -1 || blob.indexOf(SITE_TYPE) !== -1;
        if (!looksSite && !(lastEntity && (lastEntity.type === COUNTRY_TYPE || lastEntity.type === STUDY_TYPE))) {
            return false;
        }
        return isTypeaheadUrl(url) || looksSite;
    }

    function injectFilter(filter, selected) {
        var clause = countryClause(selected.code, selected.label);
        if (!clause) {
            return filter;
        }
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

    function rewriteUrl(url, selected) {
        var clause = countryClause(selected.code, selected.label);
        if (!clause) {
            return url;
        }
        if (/([?&])filter=/.test(url)) {
            return url.replace(/([?&]filter=)([^&]*)/, function (all, p1, p2) {
                try {
                    return p1 + encodeURIComponent(injectFilter(decodeURIComponent(p2), selected));
                } catch (e) {
                    return all;
                }
            });
        }
        var sep = url.indexOf("?") >= 0 ? "&" : "?";
        return url + sep + "filter=" + encodeURIComponent("(equals(type,'" + SITE_TYPE + "') and " + clause + ")");
    }

    function rewriteBody(parsed, selected) {
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return parsed;
        }
        var copy = {};
        for (var k in parsed) {
            if (Object.prototype.hasOwnProperty.call(parsed, k)) {
                copy[k] = parsed[k];
            }
        }
        copy.filter = injectFilter(parsed.filter, selected);
        return copy;
    }

    function addCountryTokensFromText(text, tokens) {
        if (!text) {
            return;
        }
        var parts = String(text).split(/[,()]/);
        for (var i = 0; i < parts.length; i++) {
            var t = parts[i].replace(/^\s+|\s+$/g, "");
            if (!t) {
                continue;
            }
            if (/^[A-Z]{2,3}$/.test(t) || isoFromLabel(t)) {
                if (tokens.indexOf(t) === -1) {
                    tokens.push(t);
                }
            }
        }
    }

    function siteCountryTokens(entity) {
        var tokens = [];
        function add(v) {
            if (v && tokens.indexOf(String(v)) === -1) {
                tokens.push(String(v));
            }
        }
        if (!entity) {
            return tokens;
        }
        add(entity.secondaryLabel);
        add(entity.secondaryLabelValue);
        addCountryTokensFromText(entity.label, tokens);
        addCountryTokensFromText(entity.secondaryLabel, tokens);
        var cc = entity.attributes && entity.attributes.CountryCode;
        if (cc) {
            var arr = Array.isArray(cc) ? cc : [cc];
            add(lookupCodeFrom(arr[0]));
            add(lookupLabelFrom(arr[0]));
        }
        return tokens;
    }

    function countryEquals(a, b) {
        if (!a || !b) {
            return false;
        }
        if (a === b) {
            return true;
        }
        return (isoFromLabel(a) || a) === (isoFromLabel(b) || b);
    }

    function siteMatchesCountry(entity, country) {
        if (!country) {
            return false;
        }
        var tokens = siteCountryTokens(entity);
        if (!tokens.length) {
            return false;
        }
        var want = isoFromLabel(country) || country;
        for (var i = 0; i < tokens.length; i++) {
            if (countryEquals(tokens[i], country) || countryEquals(tokens[i], want)) {
                return true;
            }
        }
        return false;
    }

    function collectEntities(result) {
        if (Array.isArray(result)) {
            return result;
        }
        if (result && Array.isArray(result.result)) {
            return result.result;
        }
        if (result && Array.isArray(result.entities)) {
            return result.entities;
        }
        return null;
    }

    function putEntities(result, arr) {
        if (Array.isArray(result)) {
            return arr;
        }
        if (result && result.result) {
            result.result = arr;
        }
        if (result && result.entities) {
            result.entities = arr;
        }
        return result;
    }

    function filterSiteResults(result, selected) {
        var arr = collectEntities(result);
        if (!arr) {
            return selected && (selected.code || selected.label) ? [] : result;
        }
        if (!selected || (!selected.code && !selected.label)) {
            return putEntities(result, []);
        }
        var want = selected.code || isoFromLabel(selected.label);
        var kept = [];
        for (var i = 0; i < arr.length; i++) {
            if (siteMatchesCountry(arr[i], want || selected.label)) {
                kept.push(arr[i]);
            }
        }
        return putEntities(result, kept);
    }

    function applyTypeahead(url, verb, tenant, headers, data, parsed, callback) {
        var selected = selectedCountry(lastEntity);
        if (!selected.code && selected.label) {
            selected.code = isoFromLabel(selected.label);
        }
        function finish(result, status, respHeaders) {
            var out = filterSiteResults(result, selected);
            if (typeof callback === "function") {
                callback(out, status, respHeaders);
            }
            return out;
        }
        if (!selected.code && !selected.label) {
            return finish([], 200, {});
        }
        var rewritten = rewriteBody(parsed, selected);
        var nextData = typeof data === "string" ? JSON.stringify(rewritten) : rewritten;
        var nextUrl = rewriteUrl(url, selected);
        var done = false;
        function after(result, status, respHeaders) {
            if (done) {
                return;
            }
            done = true;
            finish(result, status || 200, respHeaders || {});
        }
        var ret = UI.api(nextUrl, verb, tenant, headers, nextData, after);
        if (ret && typeof ret.then === "function") {
            ret.then(function (result) {
                after(result, 200, {});
            });
        }
        return ret;
    }

    function setLookup(entity, name, code, label) {
        entity.attributes = entity.attributes || {};
        if (firstOf(entity.attributes[name], lookupCodeFrom)) {
            return;
        }
        entity.attributes[name] = [
            {
                value: label || code,
                lookupCode: code,
                lookupValue: label || code
            }
        ];
    }

    function setSimple(entity, name, value) {
        if (!value) {
            return;
        }
        entity.attributes = entity.attributes || {};
        if (attrText(entity.attributes[name])) {
            return;
        }
        entity.attributes[name] = [{ value: value }];
    }

    function stampWrites(parsed) {
        var entity = firstEntity(parsed);
        if (!entity) {
            return parsed;
        }
        if (entity.type === SITE_TYPE) {
            var selected = selectedCountry(lastEntity);
            var code = selected.code || isoFromLabel(selected.label);
            if (code) {
                setLookup(entity, "CountryCode", code, selected.label);
            }
        }
        if (entity.type === COUNTRY_TYPE && lastStudyId) {
            setSimple(entity, "StudyId", lastStudyId);
        }
        return parsed;
    }

    function mismatchMessage(country) {
        return (
            "A [POC] Site must belong to this participating country (" +
            country +
            "). Pick or create a site of that country only."
        );
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

    function linkedSiteUri(link) {
        var val = (link && link.value) || link || {};
        return (
            val.entityId ||
            val.objectURI ||
            (val.refEntity && (val.refEntity.objectURI || val.refEntity.uri)) ||
            (link.refEntity && (link.refEntity.objectURI || link.refEntity.uri)) ||
            val.uri ||
            ""
        );
    }

    function siteCountryFromLink(link) {
        var val = (link && link.value) || link || {};
        var attrs =
            (val.attributes && val.attributes.CountryCode) ||
            (link.attributes && link.attributes.CountryCode) ||
            (val.refEntity && val.refEntity.attributes && val.refEntity.attributes.CountryCode);
        if (attrs) {
            var arr = Array.isArray(attrs) ? attrs : [attrs];
            var code = firstOf(arr, lookupCodeFrom);
            if (code) {
                return code;
            }
        }
        var tokens = [];
        addCountryTokensFromText(val.label || link.label, tokens);
        addCountryTokensFromText(val.secondaryLabel || link.secondaryLabel, tokens);
        return tokens[0] ? isoFromLabel(tokens[0]) || tokens[0] : "";
    }

    function collectSiteChecks(parsed) {
        var checks = [];
        var entity = firstEntity(parsed);
        if (!entity) {
            return checks;
        }
        function pushLinks(links, country) {
            if (!country || !Array.isArray(links)) {
                return;
            }
            for (var i = 0; i < links.length; i++) {
                var siteCountry = siteCountryFromLink(links[i]);
                if (siteCountry && !countryEquals(siteCountry, country)) {
                    checks.push({ error: mismatchMessage(country) });
                    return;
                }
                var uri = linkedSiteUri(links[i]);
                if (uri && !siteCountry) {
                    checks.push({ uri: uri, country: country });
                }
            }
        }
        if (entity.type === COUNTRY_TYPE) {
            var country = countryFromEntity(entity);
            pushLinks(entity.attributes && entity.attributes.Sites, country.code);
        }
        if (entity.type === STUDY_TYPE) {
            var refs = entity.attributes && entity.attributes.ParticipatingCountries;
            if (Array.isArray(refs)) {
                for (var j = 0; j < refs.length; j++) {
                    var val = refs[j].value || refs[j];
                    var code =
                        countryFromEntity({ attributes: val.attributes || val }).code ||
                        firstOf(val.ParticipatingCountryCode, lookupCodeFrom);
                    pushLinks(val.Sites || (val.attributes && val.attributes.Sites), code);
                }
            }
        }
        return checks;
    }

    function tenantEntitiesBase(url) {
        var u = String(url || "");
        var idx = u.indexOf("/entities");
        if (idx === -1) {
            return u;
        }
        return u.slice(0, idx) + "/entities";
    }

    function validateThenWrite(url, verb, tenant, headers, data, parsed, callback) {
        var checks = collectSiteChecks(parsed);
        for (var i = 0; i < checks.length; i++) {
            if (checks[i].error) {
                return blockSave(callback, checks[i].error);
            }
        }
        var pending = [];
        for (var j = 0; j < checks.length; j++) {
            if (checks[j].uri) {
                pending.push(checks[j]);
            }
        }
        if (!pending.length) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        var base = tenantEntitiesBase(url);
        var left = pending.length;
        var error = "";
        function done() {
            left -= 1;
            if (left > 0) {
                return;
            }
            if (error) {
                return blockSave(callback, error);
            }
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        for (var k = 0; k < pending.length; k++) {
            (function (item) {
                var id = String(item.uri).replace(/^entities\//, "");
                var getUrl = base + "/" + id + "?select=uri,attributes.CountryCode,label,secondaryLabel";
                var settled = false;
                function got(body) {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    var loaded = Array.isArray(body) ? body[0] : body;
                    if (loaded && siteCountryTokens(loaded).length && !siteMatchesCountry(loaded, item.country)) {
                        error = mismatchMessage(item.country);
                    }
                    done();
                }
                try {
                    var ret = UI.api(getUrl, "GET", tenant, headers, null, got);
                    if (ret && typeof ret.then === "function") {
                        ret.then(got, done);
                    }
                } catch (e) {
                    done();
                }
            })(pending[k]);
        }
        return null;
    }

    try {
        UI.getEntity().then(rememberEntity, function () {});
    } catch (e) {
        /* sandbox */
    }

    UI.onEvent(function (type, data) {
        rememberEntity(data);
        var deep = findCountryDeep(data, 0);
        if (deep.code || deep.label) {
            draftCountry = foundOrDraft(deep);
        }
        if (data && (data.lookupCode || isoFromLabel(lookupLabelFrom(data) || data.value || data))) {
            rememberDraftCountry(data);
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
            UI.getEntity().then(rememberEntity, function () {});
            if (isSiteSearch(url, parsed, urlOrParams)) {
                return UI.getEntity().then(
                    function (entity) {
                        rememberEntity(entity);
                        return applyTypeahead(url, verb, tenant, headers, data, parsed, callback);
                    },
                    function () {
                        return applyTypeahead(url, verb, tenant, headers, data, parsed, callback);
                    }
                );
            }
            if (isWrite(verb)) {
                parsed = stampWrites(parsed);
                data = typeof data === "string" ? JSON.stringify(parsed) : parsed;
                var written = firstEntity(parsed);
                if (written && (written.type === STUDY_TYPE || written.type === COUNTRY_TYPE)) {
                    return validateThenWrite(url, verb, tenant, headers, data, parsed, callback);
                }
            }
        } catch (err) {
            /* fall through */
        }
        return UI.api(url, verb, tenant, headers, data, callback);
    });
})();
