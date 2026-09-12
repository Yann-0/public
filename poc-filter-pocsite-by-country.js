/**
 * POC Hub: Sites Relations on [POC] Study.
 *
 * Do not filter typeahead. A site is a catalog entity with its own country.
 * Adding a site to a study is allowed only if that country is a participating
 * country of the study.
 */
(function () {
    var SITE_TYPE = "configuration/entityTypes/POCSite";
    var STUDY_TYPE = "configuration/entityTypes/POCStudy";
    var REL_STUDY_SITE = "configuration/relationTypes/POCStudyToSite";

    var lastEntity = null;

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

    function rememberEntity(entity) {
        if (!entity) {
            return;
        }
        var cand = entity.object && entity.object.type ? entity.object : entity;
        if (cand.type === STUDY_TYPE) {
            lastEntity = cand;
        }
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

    function studyCountryCodes(entity) {
        var out = [];
        var rows = entity && entity.attributes && entity.attributes.ParticipatingCountry;
        if (!Array.isArray(rows)) {
            return out;
        }
        for (var i = 0; i < rows.length; i++) {
            var val = rows[i].value || rows[i];
            var code = firstOf(val.ParticipatingCountryCode, lookupCodeFrom);
            if (code && out.indexOf(code) === -1) {
                out.push(code);
            }
        }
        return out;
    }

    function siteCountryCode(entity) {
        if (!entity || !entity.attributes) {
            return isoFromLabel(entity && entity.secondaryLabel) || isoFromLabel(entity && entity.label);
        }
        var code = firstOf(entity.attributes.CountryCode, lookupCodeFrom);
        if (code) {
            return code;
        }
        return isoFromLabel(firstOf(entity.attributes.CountryCode, lookupLabelFrom)) || isoFromLabel(entity.secondaryLabel);
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

    function mismatchMessage() {
        return "A [POC] Site can be linked only if its country is a participating country of this study.";
    }

    function blockSave(callback, message) {
        if (typeof callback === "function") {
            callback({ errorCode: 400, errorMessage: message, error: message }, 400, {});
        }
        return null;
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

    function linkedSiteUri(link) {
        var val = (link && link.value) || link || {};
        return (
            val.entityId ||
            val.objectURI ||
            (val.refEntity && (val.refEntity.objectURI || val.refEntity.uri)) ||
            ""
        );
    }

    function isStudySiteRelation(parsed) {
        var rel = firstEntity(parsed);
        var t = (rel && (rel.type || rel.relationType)) || "";
        return String(t).indexOf("POCStudyToSite") !== -1;
    }

    function objectUri(obj) {
        if (!obj) {
            return "";
        }
        return obj.objectURI || obj.uri || obj.entityId || "";
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

    function validateSiteAgainstStudy(site, study, callback) {
        var codes = studyCountryCodes(study);
        if (!codes.length) {
            return callback(mismatchMessage());
        }
        var siteCode = siteCountryCode(site);
        if (!inStudyCountries(siteCode, codes)) {
            return callback(mismatchMessage());
        }
        return callback("");
    }

    function validateThenWrite(url, verb, tenant, headers, data, parsed, callback) {
        var entity = firstEntity(parsed);
        if (!entity || entity.type !== STUDY_TYPE) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        rememberEntity(entity);
        var links = entity.attributes && entity.attributes.Sites;
        if (!Array.isArray(links) || !links.length) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        var codes = studyCountryCodes(entity);
        var pending = [];
        for (var i = 0; i < links.length; i++) {
            var uri = linkedSiteUri(links[i]);
            if (uri) {
                pending.push(uri);
            }
        }
        if (!pending.length) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        var base = tenantBase(url) + "/entities";
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
        for (var j = 0; j < pending.length; j++) {
            (function (id) {
                getJson(base + "/" + String(id).replace(/^entities\//, "") + "?select=uri,type,label,secondaryLabel,attributes.CountryCode", tenant, headers, function (site) {
                    if (site && !inStudyCountries(siteCountryCode(site), codes)) {
                        error = mismatchMessage();
                    }
                    done();
                });
            })(pending[j]);
        }
        return null;
    }

    function validateRelation(url, verb, tenant, headers, data, parsed, callback) {
        if (!isStudySiteRelation(parsed)) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        var rel = firstEntity(parsed);
        var start = objectUri(rel.startObject);
        var end = objectUri(rel.endObject);
        if (!start || !end) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        var base = tenantBase(url) + "/entities";
        getJson(base + "/" + String(start).replace(/^entities\//, "") + "?select=uri,type,attributes.ParticipatingCountry", tenant, headers, function (study) {
            if (!study && lastEntity && lastEntity.type === STUDY_TYPE) {
                study = lastEntity;
            }
            getJson(base + "/" + String(end).replace(/^entities\//, "") + "?select=uri,type,label,secondaryLabel,attributes.CountryCode", tenant, headers, function (site) {
                validateSiteAgainstStudy(site, study, function (err) {
                    if (err) {
                        return blockSave(callback, err);
                    }
                    return UI.api(url, verb, tenant, headers, data, callback);
                });
            });
        });
        return null;
    }

    try {
        UI.getEntity().then(rememberEntity, function () {});
    } catch (e) {
        /* sandbox */
    }

    UI.onEvent(function (type, data) {
        rememberEntity(data);
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
            if (isWrite(verb) && /\/relations/.test(url)) {
                return validateRelation(url, verb, tenant, headers, data, parsed, callback);
            }
            if (isWrite(verb)) {
                return validateThenWrite(url, verb, tenant, headers, data, parsed, callback);
            }
        } catch (err) {
            /* fall through */
        }
        return UI.api(url, verb, tenant, headers, data, callback);
    });
})();
