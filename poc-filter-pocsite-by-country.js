/**
 * POC Hub: reject a [POC] Site that does not belong to the participating country.
 *
 * Nested Reference typeahead cannot be filtered by Hub. This script does not
 * intercept typeahead. It only validates Study save (same path as test_Yann).
 */
(function () {
    var SITE_TYPE = "configuration/entityTypes/POCSite";
    var STUDY_TYPE = "configuration/entityTypes/POCStudy";

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

    function countryFromNested(nested) {
        var val = (nested && nested.value) || nested || {};
        return (
            firstOf(val.ParticipatingCountryCode, lookupCodeFrom) ||
            firstOf(val.CountryCode, lookupCodeFrom) ||
            lookupCodeFrom(val)
        );
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
        if (typeof attr === "object") {
            if (attr.value != null && typeof attr.value !== "object") {
                return String(attr.value);
            }
            return lookupLabelFrom(attr);
        }
        return "";
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
        var tokens = siteCountryTokens(entity);
        for (var i = 0; i < tokens.length; i++) {
            if (countryEquals(tokens[i], country)) {
                return true;
            }
        }
        return false;
    }

    function mismatchMessage(country) {
        return (
            "A [POC] Site must belong to this participating country (" +
            country +
            "). Remove sites of another country before Save."
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

    function quoteLookup(value) {
        return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    }

    function tenantEntitiesBase(url) {
        var u = String(url || "");
        var idx = u.indexOf("/entities");
        if (idx === -1) {
            return u;
        }
        return u.slice(0, idx) + "/entities";
    }

    function collectChecks(parsed) {
        var checks = [];
        var entity = firstEntity(parsed);
        if (!entity || entity.type !== STUDY_TYPE) {
            return checks;
        }
        var rows = entity.attributes && entity.attributes.ParticipatingCountry;
        if (!Array.isArray(rows)) {
            return checks;
        }
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i].value || rows[i];
            var country = countryFromNested(rows[i]);
            if (!country) {
                continue;
            }
            var links = row.LinkedSite;
            if (Array.isArray(links)) {
                for (var j = 0; j < links.length; j++) {
                    var uri = linkedSiteUri(links[j]);
                    if (uri) {
                        checks.push({ kind: "uri", uri: uri, country: country });
                    }
                }
            }
            var sites = row.Site;
            if (Array.isArray(sites)) {
                for (var k = 0; k < sites.length; k++) {
                    var siteVal = sites[k].value || sites[k];
                    var name = attrText(siteVal.Name);
                    if (name) {
                        checks.push({ kind: "name", name: name, country: country });
                    }
                }
            }
        }
        return checks;
    }

    function loadSite(base, tenant, headers, item, onDone) {
        var url;
        if (item.kind === "uri") {
            var id = String(item.uri).replace(/^entities\//, "");
            url =
                base +
                "/" +
                id +
                "?select=uri,type,label,secondaryLabel,attributes.CountryCode,attributes.Name";
        } else {
            url =
                base +
                "?filter=" +
                encodeURIComponent(
                    "equals(type,'" + SITE_TYPE + "') and equals(attributes.Name,'" + quoteLookup(item.name) + "')"
                ) +
                "&select=uri,type,label,secondaryLabel,attributes.CountryCode,attributes.Name&max=5";
        }
        var settled = false;
        function finish(body) {
            if (settled) {
                return;
            }
            settled = true;
            onDone(body);
        }
        try {
            var ret = UI.api(url, "GET", tenant, headers, null, finish);
            if (ret && typeof ret.then === "function") {
                ret.then(finish, function () {
                    finish(null);
                });
            }
        } catch (e) {
            finish(null);
        }
    }

    function firstLoaded(body) {
        if (!body) {
            return null;
        }
        if (Array.isArray(body)) {
            return body[0] || null;
        }
        if (body.result && Array.isArray(body.result)) {
            return body.result[0] || null;
        }
        return body;
    }

    function validateThenWrite(url, verb, tenant, headers, data, parsed, callback) {
        var checks = collectChecks(parsed);
        if (!checks.length) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
        var base = tenantEntitiesBase(url);
        var left = checks.length;
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
        for (var i = 0; i < checks.length; i++) {
            (function (item) {
                loadSite(base, tenant, headers, item, function (body) {
                    var loaded = firstLoaded(body);
                    if (loaded && siteCountryTokens(loaded).length && !siteMatchesCountry(loaded, item.country)) {
                        error = mismatchMessage(item.country);
                    }
                    done();
                });
            })(checks[i]);
        }
        return null;
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
        try {
            if (isWrite(verb) && firstEntity(parsed) && firstEntity(parsed).type === STUDY_TYPE) {
                return validateThenWrite(url, verb, tenant, headers, data, parsed, callback);
            }
        } catch (err) {
            /* fall through */
        }
        return UI.api(url, verb, tenant, headers, data, callback);
    });
})();
