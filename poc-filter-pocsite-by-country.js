/**
 * POC Hub: a [POC] Site can be linked to a [POC] Study only if the site
 * country is already a participating country of that study.
 *
 * Hub nui ignores a 400 envelope from customScripts (see test_Yann).
 * Block with [{ successful: false }] and status 200, and paint the error
 * in the Custom facet on [POC] Study.
 */
(function () {
    var SITE_TYPE = "configuration/entityTypes/POCSite";
    var STUDY_TYPE = "configuration/entityTypes/POCStudy";
    var MESSAGE =
        "A [POC] Site can be linked only if its country is a participating country of this study.";
    var HELP =
        "Add the country on the study first. A site of another country is rejected.";

    var lastEntity = null;
    var canRender = false;
    var lastError = "";

    var ISO_BY_NAME = {
        afghanistan: "AF", albania: "AL", algeria: "DZ", angola: "AO",
        argentina: "AR", australia: "AU", austria: "AT", belgium: "BE",
        brazil: "BR", canada: "CA", china: "CN", france: "FR", germany: "DE",
        india: "IN", italy: "IT", japan: "JP", mexico: "MX", morocco: "MA",
        netherlands: "NL", poland: "PL", portugal: "PT", spain: "ES",
        sweden: "SE", switzerland: "CH", tunisia: "TN", turkey: "TR",
        turkiye: "TR", "united kingdom": "GB", "united states": "US"
    };

    function isoFromLabel(label) {
        if (!label) {
            return "";
        }
        var raw = String(label).toLowerCase().replace(/^\s+|\s+$/g, "");
        var paren = raw.match(/\(([^)]+)\)\s*$/);
        if (paren && ISO_BY_NAME[paren[1]]) {
            return ISO_BY_NAME[paren[1]];
        }
        return ISO_BY_NAME[raw] || "";
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

    function lookupCodeFrom(obj) {
        if (obj == null) {
            return "";
        }
        if (typeof obj === "string") {
            var s = obj.replace(/^\s+|\s+$/g, "");
            if (/^[A-Za-z]{2,3}$/.test(s)) {
                return s.toUpperCase();
            }
            return isoFromLabel(s);
        }
        if (typeof obj !== "object") {
            return "";
        }
        if (obj.lookupCode) {
            return String(obj.lookupCode).toUpperCase();
        }
        if (obj.value && typeof obj.value === "object") {
            return lookupCodeFrom(obj.value);
        }
        if (typeof obj.value === "string") {
            return lookupCodeFrom(obj.value);
        }
        if (obj.lookupValue) {
            return isoFromLabel(obj.lookupValue);
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

    function isStudy(entity) {
        return !!(entity && entity.type === STUDY_TYPE);
    }

    function rememberEntity(entity) {
        if (!entity) {
            return;
        }
        var cand = entity.object && entity.object.type ? entity.object : entity;
        if (isStudy(cand)) {
            lastEntity = cand;
        }
    }

    function countryEquals(a, b) {
        if (!a || !b) {
            return false;
        }
        var aa = String(a).toUpperCase();
        var bb = String(b).toUpperCase();
        if (aa === bb) {
            return true;
        }
        return (isoFromLabel(a) || aa) === (isoFromLabel(b) || bb);
    }

    function studyCountryCodes(entity) {
        var out = [];
        var rows = entity && entity.attributes && entity.attributes.ParticipatingCountry;
        if (!Array.isArray(rows)) {
            return out;
        }
        for (var i = 0; i < rows.length; i++) {
            var val = rows[i].value || rows[i];
            var code = firstOf(val.ParticipatingCountryCode, lookupCodeFrom);
            if (!code && val.ParticipatingCountryCode) {
                code = lookupCodeFrom(val.ParticipatingCountryCode);
            }
            if (code && out.indexOf(code) === -1) {
                out.push(code);
            }
        }
        return out;
    }

    function siteCountryFromAttrs(attrs) {
        if (!attrs) {
            return "";
        }
        var code = firstOf(attrs.CountryCode, lookupCodeFrom);
        if (code) {
            return code;
        }
        return lookupCodeFrom(attrs.CountryCode);
    }

    function siteCountryFromLabel(label) {
        if (!label) {
            return "";
        }
        var m = String(label).match(/\(([^)]+)\)\s*$/);
        if (m) {
            return isoFromLabel(m[1]) || lookupCodeFrom(m[1]);
        }
        return isoFromLabel(label);
    }

    function linkedSiteUri(link) {
        if (!link || typeof link !== "object") {
            return "";
        }
        var val = link.value && typeof link.value === "object" ? link.value : {};
        var ref = link.refEntity || val.refEntity || {};
        return (
            ref.objectURI ||
            ref.uri ||
            link.entityURI ||
            link.entityId ||
            link.objectURI ||
            (typeof link.uri === "string" && link.uri.indexOf("entities/") !== -1 ? link.uri : "") ||
            val.entityId ||
            val.objectURI ||
            ""
        );
    }

    function countryFromLink(link) {
        if (!link || typeof link !== "object") {
            return siteCountryFromLabel(link);
        }
        var val = link.value && typeof link.value === "object" ? link.value : link;
        var code = siteCountryFromAttrs(val);
        if (code) {
            return code;
        }
        var ref = link.refEntity || val.refEntity || {};
        return (
            siteCountryFromLabel(ref.label) ||
            siteCountryFromLabel(ref.secondaryLabel) ||
            siteCountryFromLabel(link.label) ||
            siteCountryFromLabel(val.label)
        );
    }

    function siteLinks(entity) {
        var rows = entity && entity.attributes && entity.attributes.Sites;
        return Array.isArray(rows) ? rows : [];
    }

    function inStudyCountries(siteCode, studyCodes) {
        if (!siteCode) {
            return false;
        }
        for (var i = 0; i < studyCodes.length; i++) {
            if (countryEquals(siteCode, studyCodes[i])) {
                return true;
            }
        }
        return false;
    }

    function mismatchOnEntity(entity) {
        if (!isStudy(entity)) {
            return "";
        }
        var codes = studyCountryCodes(entity);
        var links = siteLinks(entity);
        for (var i = 0; i < links.length; i++) {
            var code = countryFromLink(links[i]);
            if (!code || !inStudyCountries(code, codes)) {
                return MESSAGE;
            }
        }
        return "";
    }

    function paint(message) {
        lastError = message || "";
        if (!canRender) {
            return;
        }
        var text = lastError || HELP;
        var color = lastError ? "#d32f2f" : "#6a6d70";
        try {
            UI.setVisibility("visible");
            UI.setHtml(
                '<div style="font-family:Roboto,Helvetica,Arial,sans-serif;color:' +
                    color +
                    ';font-size:12px;line-height:16px;padding:4px 16px 12px;">' +
                    text +
                    "</div>"
            );
            UI.setHeight(44);
        } catch (e) {
            canRender = false;
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

    function block(callback, message) {
        paint(message || MESSAGE);
        return send(callback, blockedBody(), 200, {});
    }

    function tenantBase(url) {
        var u = String(url || "");
        var idx = u.indexOf("/reltio/api/");
        if (idx === -1) {
            return u.split("/entities")[0] || u.split("/relations")[0];
        }
        var rest = u.slice(idx);
        var parts = rest.split("/");
        return u.slice(0, idx) + parts.slice(0, 4).join("/");
    }

    function objectUri(obj) {
        if (!obj) {
            return "";
        }
        return obj.objectURI || obj.uri || obj.entityId || "";
    }

    function isStudySiteRelation(parsed) {
        var rel = firstEntity(parsed);
        var t = (rel && (rel.type || rel.relationType)) || "";
        return String(t).indexOf("POCStudyToSite") !== -1;
    }

    function hasSites(payload) {
        if (!payload || typeof payload !== "object") {
            return false;
        }
        if (payload.attributes && Array.isArray(payload.attributes.Sites) && payload.attributes.Sites.length) {
            return true;
        }
        if (Array.isArray(payload.Sites) && payload.Sites.length) {
            return true;
        }
        if (Array.isArray(payload)) {
            for (var i = 0; i < payload.length; i++) {
                if (hasSites(payload[i])) {
                    return true;
                }
            }
        }
        return false;
    }

    function getJson(url, tenant, headers, callback) {
        var settled = false;
        function got(body) {
            if (settled) {
                return;
            }
            settled = true;
            callback(Array.isArray(body) ? body[0] : body);
        }
        try {
            var ret = UI.api(url, "GET", tenant, headers, null, got);
            if (ret && typeof ret.then === "function") {
                ret.then(got, function () {
                    got(null);
                });
            }
        } catch (e) {
            got(null);
        }
    }

    function studyFromContext(parsed) {
        var entity = firstEntity(parsed);
        if (isStudy(entity)) {
            return entity;
        }
        if (lastEntity && isStudy(lastEntity) && hasSites(parsed)) {
            var merged = {
                type: STUDY_TYPE,
                attributes: {
                    ParticipatingCountry:
                        (entity && entity.attributes && entity.attributes.ParticipatingCountry) ||
                        lastEntity.attributes.ParticipatingCountry,
                    Sites:
                        (entity && entity.attributes && entity.attributes.Sites) ||
                        parsed.Sites
                }
            };
            return merged;
        }
        return entity;
    }

    function validateLinks(links, codes, url, tenant, headers, callback) {
        var pending = [];
        var immediate = "";
        for (var i = 0; i < links.length; i++) {
            var code = countryFromLink(links[i]);
            if (code) {
                if (!inStudyCountries(code, codes)) {
                    immediate = MESSAGE;
                    break;
                }
            } else {
                var uri = linkedSiteUri(links[i]);
                if (uri) {
                    pending.push(uri);
                } else {
                    immediate = MESSAGE;
                    break;
                }
            }
        }
        if (immediate) {
            return callback(immediate);
        }
        if (!pending.length) {
            return callback("");
        }
        var base = tenantBase(url) + "/entities";
        var left = pending.length;
        var error = "";
        function done() {
            left -= 1;
            if (left > 0) {
                return;
            }
            callback(error);
        }
        for (var j = 0; j < pending.length; j++) {
            (function (id) {
                getJson(
                    base + "/" + String(id).replace(/^entities\//, "") + "?select=uri,type,label,secondaryLabel,attributes.CountryCode",
                    tenant,
                    headers,
                    function (site) {
                        var code = site ? siteCountryFromAttrs(site.attributes) || siteCountryFromLabel(site.label) || siteCountryFromLabel(site.secondaryLabel) : "";
                        if (!site || !inStudyCountries(code, codes)) {
                            error = MESSAGE;
                        }
                        done();
                    }
                );
            })(pending[j]);
        }
    }

    function validateStudyWrite(url, verb, tenant, headers, data, parsed, callback) {
        function pass() {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        var study = studyFromContext(parsed);
        if (!isStudy(study) && !(lastEntity && isStudy(lastEntity) && hasSites(parsed))) {
            return pass();
        }
        if (isStudy(study)) {
            rememberEntity(study);
        }
        var links = siteLinks(study);
        if (!links.length && hasSites(parsed)) {
            var ent = firstEntity(parsed);
            links = (ent && ent.attributes && ent.attributes.Sites) || parsed.Sites || [];
        }
        if (!links.length) {
            paint(mismatchOnEntity(study || lastEntity));
            return pass();
        }
        var codes = studyCountryCodes(study);
        if (!codes.length && lastEntity) {
            codes = studyCountryCodes(lastEntity);
        }
        if (!codes.length) {
            return block(callback, MESSAGE);
        }
        validateLinks(links, codes, url, tenant, headers, function (err) {
            if (err) {
                return block(callback, err);
            }
            paint("");
            return pass();
        });
        return null;
    }

    function validateRelation(url, verb, tenant, headers, data, parsed, callback) {
        function pass() {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        if (!isStudySiteRelation(parsed)) {
            return pass();
        }
        var rel = firstEntity(parsed);
        var start = objectUri(rel.startObject);
        var end = objectUri(rel.endObject);
        var codes = lastEntity ? studyCountryCodes(lastEntity) : [];
        var endLabel = (rel.endObject && (rel.endObject.label || rel.endObject.secondaryLabel)) || "";
        var fromLabel = siteCountryFromLabel(endLabel);
        if (fromLabel && codes.length) {
            if (!inStudyCountries(fromLabel, codes)) {
                return block(callback, MESSAGE);
            }
            paint("");
            return pass();
        }
        if (!start || !end) {
            return block(callback, MESSAGE);
        }
        var base = tenantBase(url) + "/entities";
        getJson(base + "/" + String(start).replace(/^entities\//, "") + "?select=uri,type,attributes.ParticipatingCountry", tenant, headers, function (study) {
            if (!study && lastEntity) {
                study = lastEntity;
            }
            var studyCodes = studyCountryCodes(study);
            getJson(base + "/" + String(end).replace(/^entities\//, "") + "?select=uri,type,label,secondaryLabel,attributes.CountryCode", tenant, headers, function (site) {
                var code = site ? siteCountryFromAttrs(site.attributes) || siteCountryFromLabel(site.label) : "";
                if (!studyCodes.length || !inStudyCountries(code, studyCodes)) {
                    return block(callback, MESSAGE);
                }
                paint("");
                return UI.api(url, verb, tenant, headers, data, callback);
            });
        });
        return null;
    }

    function handleWrite(url, verb, tenant, headers, data, callback) {
        var parsed = parseData(data);
        if (/\/relations/.test(url)) {
            return validateRelation(url, verb, tenant, headers, data, parsed, callback);
        }
        var entity = firstEntity(parsed);
        if (entity && entity.type && entity.type !== STUDY_TYPE && String(entity.type).indexOf(STUDY_TYPE + "/") !== 0) {
            if (entity.type === SITE_TYPE) {
                return UI.api(url, verb, tenant, headers, data, callback);
            }
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        if (isStudy(entity) || hasSites(parsed)) {
            return validateStudyWrite(url, verb, tenant, headers, data, parsed, callback);
        }
        try {
            return UI.getEntity().then(
                function (loaded) {
                    rememberEntity(loaded);
                    if (isStudy(loaded) && hasSites(parsed)) {
                        return validateStudyWrite(url, verb, tenant, headers, data, parsed, callback);
                    }
                    return UI.api(url, verb, tenant, headers, data, callback);
                },
                function () {
                    return UI.api(url, verb, tenant, headers, data, callback);
                }
            );
        } catch (e) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
    }

    try {
        UI.setVisibility("visible");
        canRender = true;
        paint("");
    } catch (e) {
        canRender = false;
    }

    try {
        UI.getEntity().then(
            function (entity) {
                rememberEntity(entity);
                paint(mismatchOnEntity(entity));
            },
            function () {}
        );
    } catch (e) {
        /* sandbox */
    }

    UI.onEvent(function (type, data) {
        if (type === "updateEntity") {
            rememberEntity(data);
            paint(mismatchOnEntity(data) || mismatchOnEntity(lastEntity));
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
