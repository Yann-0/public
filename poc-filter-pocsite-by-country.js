/**
 * POC Hub: [POC] Site typeahead and Study save.
 *
 * Filter is never a hardcoded country. It always uses the Participating Country
 * selected on the current nested row (lookup code of that RDM value).
 * Config: equals(attributes.CountryCode, '{ParticipatingCountryCode.lookupCode}').
 * If Hub leaves the placeholder, this script substitutes the selected row's code.
 */
(function () {
    var SITE_TYPE = "configuration/entityTypes/POCSite";
    var STUDY_TYPE = "configuration/entityTypes/POCStudy";
    var TEST_YANN = "configuration/entityTypes/test_Yann";
    var MAX_LEN = 10;
    var COUNTRY_EQUALS_RE = /equals\(\s*attributes\.CountryCode\s*,\s*(?:'[^']*'|\{[^}]*\})\s*\)/g;

    var lastEntity = null;
    var draftCountry = { code: "", label: "" };
    // Label → ISO 3166-1 alpha-2. Used only when Hub gives the selected country
    // name (Angola) without lookupCode. Not a hardcoded filter.
    var ISO_BY_NAME = {
        afghanistan: "AF", albania: "AL", algeria: "DZ", "american samoa": "AS",
        andorra: "AD", angola: "AO", anguilla: "AI", antarctica: "AQ",
        "antigua and barbuda": "AG", argentina: "AR", armenia: "AM", aruba: "AW",
        australia: "AU", austria: "AT", azerbaijan: "AZ", bahamas: "BS",
        bahrain: "BH", bangladesh: "BD", barbados: "BB", belarus: "BY",
        belgium: "BE", belize: "BZ", benin: "BJ", bermuda: "BM", bhutan: "BT",
        bolivia: "BO", "bosnia and herzegovina": "BA", botswana: "BW",
        "bouvet island": "BV", brazil: "BR", "british indian ocean territory": "IO",
        "brunei darussalam": "BN", bulgaria: "BG", "burkina faso": "BF", burundi: "BI",
        "cabo verde": "CV", "cape verde": "CV", cambodia: "KH", cameroon: "CM",
        canada: "CA", "cayman islands": "KY", "central african republic": "CF",
        chad: "TD", chile: "CL", china: "CN", "christmas island": "CX",
        "cocos islands": "CC", colombia: "CO", comoros: "KM", congo: "CG",
        "congo (the democratic republic of the)": "CD", "democratic republic of the congo": "CD",
        "cook islands": "CK", "costa rica": "CR", croatia: "HR", cuba: "CU",
        curacao: "CW", cyprus: "CY", czechia: "CZ", "czech republic": "CZ",
        "cote d'ivoire": "CI", "côte d'ivoire": "CI", "ivory coast": "CI",
        denmark: "DK", djibouti: "DJ", dominica: "DM", "dominican republic": "DO",
        ecuador: "EC", egypt: "EG", "el salvador": "SV", "equatorial guinea": "GQ",
        eritrea: "ER", estonia: "EE", eswatini: "SZ", swaziland: "SZ", ethiopia: "ET",
        "falkland islands": "FK", "faroe islands": "FO", fiji: "FJ", finland: "FI",
        france: "FR", "french guiana": "GF", "french polynesia": "PF",
        "french southern territories": "TF", gabon: "GA", gambia: "GM", georgia: "GE",
        germany: "DE", ghana: "GH", gibraltar: "GI", greece: "GR", greenland: "GL",
        grenada: "GD", guadeloupe: "GP", guam: "GU", guatemala: "GT", guernsey: "GG",
        guinea: "GN", "guinea-bissau": "GW", guyana: "GY", haiti: "HT",
        "heard island and mcdonald islands": "HM", "holy see": "VA", honduras: "HN",
        "hong kong": "HK", hungary: "HU", iceland: "IS", india: "IN", indonesia: "ID",
        iran: "IR", iraq: "IQ", ireland: "IE", "isle of man": "IM", israel: "IL",
        italy: "IT", jamaica: "JM", japan: "JP", jersey: "JE", jordan: "JO",
        kazakhstan: "KZ", kenya: "KE", kiribati: "KI", kuwait: "KW", kyrgyzstan: "KG",
        laos: "LA", "lao people's democratic republic": "LA", latvia: "LV",
        lebanon: "LB", lesotho: "LS", liberia: "LR", libya: "LY", liechtenstein: "LI",
        lithuania: "LT", luxembourg: "LU", macao: "MO", madagascar: "MG", malawi: "MW",
        malaysia: "MY", maldives: "MV", mali: "ML", malta: "MT", "marshall islands": "MH",
        martinique: "MQ", mauritania: "MR", mauritius: "MU", mayotte: "YT", mexico: "MX",
        micronesia: "FM", moldova: "MD", monaco: "MC", mongolia: "MN", montenegro: "ME",
        montserrat: "MS", morocco: "MA", mozambique: "MZ", myanmar: "MM", namibia: "NA",
        nauru: "NR", nepal: "NP", netherlands: "NL", "new caledonia": "NC",
        "new zealand": "NZ", nicaragua: "NI", niger: "NE", nigeria: "NG", niue: "NU",
        "norfolk island": "NF", "north korea": "KP", "north macedonia": "MK",
        "macedonia": "MK", "northern mariana islands": "MP", norway: "NO", oman: "OM",
        pakistan: "PK", palau: "PW", palestine: "PS", panama: "PA",
        "papua new guinea": "PG", paraguay: "PY", peru: "PE", philippines: "PH",
        pitcairn: "PN", poland: "PL", portugal: "PT", "puerto rico": "PR", qatar: "QA",
        reunion: "RE", "réunion": "RE", romania: "RO", "russian federation": "RU",
        russia: "RU", rwanda: "RW", "saint barthelemy": "BL", "saint helena": "SH",
        "saint kitts and nevis": "KN", "saint lucia": "LC", "saint martin": "MF",
        "saint pierre and miquelon": "PM", "saint vincent and the grenadines": "VC",
        samoa: "WS", "san marino": "SM", "sao tome and principe": "ST",
        "saudi arabia": "SA", senegal: "SN", serbia: "RS", seychelles: "SC",
        "sierra leone": "SL", singapore: "SG", "sint maarten": "SX", slovakia: "SK",
        slovenia: "SI", "solomon islands": "SB", somalia: "SO", "south africa": "ZA",
        "south georgia": "GS", "south korea": "KR", "korea, republic of": "KR",
        "korea, republic of the": "KR", "republic of korea": "KR", "south sudan": "SS",
        spain: "ES", "sri lanka": "LK", sudan: "SD", suriname: "SR",
        "svalbard and jan mayen": "SJ", sweden: "SE", switzerland: "CH",
        "syrian arab republic": "SY", syria: "SY", taiwan: "TW", tajikistan: "TJ",
        tanzania: "TZ", thailand: "TH", "timor-leste": "TL", togo: "TG", tokelau: "TK",
        tonga: "TO", "trinidad and tobago": "TT", tunisia: "TN", turkey: "TR",
        turkiye: "TR", türkiye: "TR", turkmenistan: "TM", "turks and caicos islands": "TC",
        tuvalu: "TV", uganda: "UG", ukraine: "UA", "united arab emirates": "AE",
        "united kingdom": "GB", "great britain": "GB", "united states": "US",
        "united states of america": "US", uruguay: "UY", uzbekistan: "UZ", vanuatu: "VU",
        venezuela: "VE", vietnam: "VN", "viet nam": "VN",
        "virgin islands, british": "VG", "virgin islands, u.s.": "VI",
        "wallis and futuna": "WF", "western sahara": "EH", yemen: "YE", zambia: "ZM",
        zimbabwe: "ZW"
    };

    function isoFromLabel(label) {
        if (!label) {
            return "";
        }
        var key = String(label).toLowerCase().replace(/^\s+|\s+$/g, "");
        return ISO_BY_NAME[key] || "";
    }

    function quoteLookup(value) {
        return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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

    function isTypeaheadUrl(url) {
        var u = String(url || "");
        return (
            /\/entities\/_typeAheadSearch(?:[/?]|$)/.test(u) ||
            /\/entities\/_search(?:[/?]|$)/.test(u) ||
            /\/entities\/_suggest(?:[/?]|$)/.test(u)
        );
    }

    function requestBlob(url, parsed, rawParams) {
        var extra = "";
        if (rawParams && typeof rawParams === "object") {
            extra += JSON.stringify({
                type: rawParams.type || rawParams.entityType || rawParams.entityTypes || "",
                select: rawParams.select || ""
            });
        }
        return String(url || "") + JSON.stringify(parsed || {}) + extra;
    }

    function isOtherTypeSearch(blob) {
        return (
            /entityTypes\/(HCP|HCO|Location|Individual|POCInvestigator|POCStudy|POCParticipatingCountry)\b/.test(blob) &&
            blob.indexOf("POCSite") === -1 &&
            blob.indexOf(SITE_TYPE) === -1
        );
    }

    function isSiteSearch(url, parsed, rawParams) {
        var blob = requestBlob(url, parsed, rawParams);
        if (blob.indexOf(SITE_TYPE) !== -1 || blob.indexOf("POCSite") !== -1) {
            return isTypeaheadUrl(url) || /filter=/.test(String(url || "")) || /filter/.test(JSON.stringify(parsed || {}));
        }
        if (isOtherTypeSearch(blob)) {
            return false;
        }
        if (!isTypeaheadUrl(url)) {
            return false;
        }
        return !!(lastEntity && lastEntity.type === STUDY_TYPE);
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
        return lookupCodeFrom(arr[0]) || isoFromLabel(firstLabel(arr));
    }

    function firstLabel(arr) {
        if (!Array.isArray(arr) || !arr.length) {
            return "";
        }
        var o = arr[0];
        if (typeof o === "string") {
            return o;
        }
        return lookupLabelFrom(o) || (typeof o.value === "string" ? o.value : "");
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
        return lookupCodeFrom(nested) || lookupCodeFrom(val) || isoFromLabel(lookupLabelFrom(val) || lookupLabelFrom(nested));
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
            return codeFromLabel(label, entity || lastEntity) || isoFromLabel(label);
        }
        if (typeof node === "string") {
            if (/^[A-Z]{2,3}$/.test(node)) {
                return node;
            }
            return codeFromLabel(node, entity || lastEntity) || isoFromLabel(node);
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

    function selectedCountryFromFilter(filter) {
        var quoted = String(filter || "").match(/equals\(\s*attributes\.CountryCode\s*,\s*'([^']*)'\s*\)/);
        if (!quoted || !quoted[1] || quoted[1].indexOf("{") !== -1) {
            return "";
        }
        if (quoted[1] === "__COUNTRY_REQUIRED__") {
            return "";
        }
        return extractCode(quoted[1], lastEntity) || quoted[1];
    }

    function pickCountry(url, parsed, rawParams, entity) {
        var fromReq = countryFromRequest(url, parsed, rawParams, entity);
        if (fromReq) {
            return fromReq;
        }
        var fromHubFilter = selectedCountryFromFilter((parsed && parsed.filter) || url);
        if (fromHubFilter) {
            if (/^[A-Z]{2,3}$/.test(fromHubFilter)) {
                return fromHubFilter;
            }
            var transcoded = isoFromLabel(fromHubFilter);
            if (transcoded) {
                return transcoded;
            }
        }
        var fromEntity = countriesFromEntity(entity || lastEntity);
        if (fromEntity.length === 1) {
            return fromEntity[0];
        }
        return "";
    }

    function findParticipatingCountry(node, depth) {
        if (!node || depth > 8 || typeof node !== "object") {
            return { code: "", label: "" };
        }
        if (node.ParticipatingCountryCode) {
            var arr = node.ParticipatingCountryCode;
            return {
                code: firstLookup(arr) || isoFromLabel(firstLabel(arr)),
                label: firstLabel(arr)
            };
        }
        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i++) {
                var found = findParticipatingCountry(node[i], depth + 1);
                if (found.code || found.label) {
                    return found;
                }
            }
            return { code: "", label: "" };
        }
        for (var k in node) {
            if (!Object.prototype.hasOwnProperty.call(node, k)) {
                continue;
            }
            if (k === "filter" || k === "select") {
                continue;
            }
            var nested = findParticipatingCountry(node[k], depth + 1);
            if (nested.code || nested.label) {
                return nested;
            }
        }
        return { code: "", label: "" };
    }

    function pickSelected(url, parsed, rawParams, entity) {
        var fromTree = findParticipatingCountry(parsed, 0);
        if (!fromTree.code && !fromTree.label) {
            fromTree = findParticipatingCountry(rawParams, 0);
        }
        var e = entity || lastEntity;
        if (!fromTree.code && !fromTree.label) {
            fromTree = findParticipatingCountry(e, 0);
        }
        var code = fromTree.code || pickCountry(url, parsed, rawParams, e);
        var label = fromTree.label;
        var rows = e && e.attributes && e.attributes.ParticipatingCountry;
        if (Array.isArray(rows) && rows.length > 1 && (draftCountry.code || draftCountry.label)) {
            return {
                code: draftCountry.code || isoFromLabel(draftCountry.label),
                label: draftCountry.label
            };
        }
        if (Array.isArray(rows) && rows.length === 1) {
            label = firstLabel((rows[0].value || rows[0]).ParticipatingCountryCode);
            if (!code) {
                code = firstLookup((rows[0].value || rows[0]).ParticipatingCountryCode);
            }
        }
        if (!label) {
            var fromFilter = selectedCountryFromFilter((parsed && parsed.filter) || url);
            if (fromFilter && !/^[A-Z]{2,3}$/.test(fromFilter)) {
                label = fromFilter;
            }
        }
        if (!code && label) {
            code = isoFromLabel(label);
        }
        if (!code && !label && (draftCountry.code || draftCountry.label)) {
            return { code: draftCountry.code, label: draftCountry.label };
        }
        return { code: code, label: label };
    }

    function removeCountryEquals(filter) {
        var f = String(filter || "");
        f = f.replace(/\s*and\s*equals\(\s*attributes\.CountryCode\s*,\s*(?:'[^']*'|\{[^}]*\})\s*\)/gi, "");
        f = f.replace(/equals\(\s*attributes\.CountryCode\s*,\s*(?:'[^']*'|\{[^}]*\})\s*\)\s*and\s*/gi, "");
        f = f.replace(/equals\(\s*attributes\.CountryCode\s*,\s*(?:'[^']*'|\{[^}]*\})\s*\)/gi, "");
        f = f.replace(/\(\s*and\s*/g, "(");
        f = f.replace(/\s*and\s*\)/g, ")");
        f = f.replace(/\(\s*\)/g, "");
        return f.replace(/^\s+|\s+$/g, "");
    }

    function stripUnresolvedCountryFilter(parsed, data) {
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return typeof data === "string" ? stripUnresolvedCountryFilterUrl(data) : data;
        }
        var copy = {};
        for (var k in parsed) {
            if (Object.prototype.hasOwnProperty.call(parsed, k)) {
                copy[k] = parsed[k];
            }
        }
        if (copy.filter) {
            copy.filter = removeCountryEquals(parsed.filter);
        }
        return typeof data === "string" ? JSON.stringify(copy) : copy;
    }

    function stripUnresolvedCountryFilterUrl(url) {
        if (!url || !/([?&])filter=/.test(url)) {
            return url;
        }
        return url.replace(/([?&]filter=)([^&]*)/, function (all, p1, p2) {
            try {
                var decoded = decodeURIComponent(p2);
                var next = removeCountryEquals(decoded);
                return p1 + encodeURIComponent(next);
            } catch (e) {
                return all;
            }
        });
    }

    function injectFilter(filter, selectedCode) {
        var selected = pickSelected("", { filter: filter }, null, lastEntity);
        var clause = countryClause(selectedCode || selected.code, selected.label);
        if (!clause && selectedCode) {
            clause = countryClause(selectedCode, "");
        }
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

    function rewriteUrl(url, code) {
        if (!code) {
            return url;
        }
        var selected = pickSelected("", { filter: "" }, null, lastEntity);
        var clause = countryClause(code, selected.label);
        if (!clause) {
            clause = countryClause(code, "");
        }
        if (/([?&])filter=/.test(url)) {
            return url.replace(/([?&]filter=)([^&]*)/, function (all, p1, p2) {
                var decoded = decodeURIComponent(p2);
                return p1 + encodeURIComponent(injectFilter(decoded, code));
            });
        }
        var sep = url.indexOf("?") >= 0 ? "&" : "?";
        return url + sep + "filter=" + encodeURIComponent("(equals(type,'" + SITE_TYPE + "') and " + clause + ")");
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

    function rememberDraftCountry(node) {
        if (node == null) {
            return;
        }
        var label = lookupLabelFrom(node);
        if (!label && typeof node === "string") {
            label = node;
        }
        if (!label && node && typeof node.value === "string") {
            label = node.value;
        }
        var code = lookupCodeFrom(node) || isoFromLabel(label);
        if (!code && !label) {
            return;
        }
        draftCountry = { code: code || isoFromLabel(label), label: label };
    }

    function rememberEntity(entity) {
        if (!entity) {
            return;
        }
        var cand = entity;
        if (entity.object && (entity.object.attributes || entity.object.type)) {
            cand = entity.object;
        }
        if (cand.type && cand.type !== STUDY_TYPE) {
            return;
        }
        if (!cand.type && !cand.attributes) {
            return;
        }
        lastEntity = cand;
        var rows = lastEntity && lastEntity.attributes && lastEntity.attributes.ParticipatingCountry;
        if (Array.isArray(rows) && rows.length === 1) {
            rememberDraftCountry((rows[0].value || rows[0]).ParticipatingCountryCode);
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

    function countryEquals(a, b) {
        if (!a || !b) {
            return false;
        }
        if (a === b) {
            return true;
        }
        var ac = isoFromLabel(a) || a;
        var bc = isoFromLabel(b) || b;
        return ac === bc;
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
                if (siteCountry && !countryEquals(siteCountry, country)) {
                    return mismatchMessage(country);
                }
            }
        }
        return "";
    }

    function linkedSitesNeedingLookup(parsed) {
        var pending = [];
        var entity = firstEntity(parsed);
        if (!entity || entity.type !== STUDY_TYPE) {
            return pending;
        }
        var rows = entity.attributes && entity.attributes.ParticipatingCountry;
        if (!Array.isArray(rows)) {
            return pending;
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
                if (siteCountryFromLink(links[j])) {
                    continue;
                }
                var uri = linkedSiteUri(links[j]);
                if (uri) {
                    pending.push({ uri: uri, country: country });
                }
            }
        }
        return pending;
    }

    function finishWrite(url, verb, tenant, headers, data, parsed, callback) {
        var written = firstEntity(parsed);
        if (written && written.type === SITE_TYPE && lastEntity && lastEntity.type === STUDY_TYPE) {
            var stampCode = pickCountry(url, parsed, null, lastEntity);
            parsed = stampSiteCountry(parsed, stampCode);
            data = typeof data === "string" ? JSON.stringify(parsed) : parsed;
        }
        return handleTestYannWrite(url, verb, tenant, headers, data, parsed, callback);
    }

    function validateLinkedSitesThenWrite(url, verb, tenant, headers, data, parsed, callback) {
        var pending = linkedSitesNeedingLookup(parsed);
        if (!pending.length) {
            return finishWrite(url, verb, tenant, headers, data, parsed, callback);
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
            finishWrite(url, verb, tenant, headers, data, parsed, callback);
        }
        for (var i = 0; i < pending.length; i++) {
            (function (item) {
                var id = String(item.uri).replace(/^entities\//, "");
                var getUrl = base + "/" + id + "?select=uri,type,attributes.CountryCode,attributes.Name,label,secondaryLabel";
                var settled = false;
                function got(body) {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    var loaded = body;
                    if (Array.isArray(body)) {
                        loaded = body[0];
                    }
                    var selected = { code: item.country, label: item.country };
                    if (loaded && resultCountryTokens(loaded).length && !siteMatchesSelected(loaded, selected)) {
                        error = mismatchMessage(item.country);
                    }
                    done();
                }
                function fail() {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    done();
                }
                try {
                    var ret = UI.api(getUrl, "GET", tenant, headers, null, got);
                    if (ret && typeof ret.then === "function") {
                        ret.then(got, fail);
                    }
                } catch (e) {
                    fail();
                }
            })(pending[i]);
        }
        return null;
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

    function resultCountryTokens(entity) {
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
            add(firstLookup(arr));
            add(firstLabel(arr));
        }
        return tokens;
    }

    function siteMatchesSelected(entity, selected) {
        if (!selected || (!selected.code && !selected.label)) {
            return true;
        }
        var tokens = resultCountryTokens(entity);
        if (!tokens.length) {
            return false;
        }
        var wantCode = selected.code || isoFromLabel(selected.label);
        var wantLabel = String(selected.label || "").toLowerCase();
        for (var i = 0; i < tokens.length; i++) {
            var t = tokens[i];
            if (wantCode && (t === wantCode || isoFromLabel(t) === wantCode)) {
                return true;
            }
            if (wantLabel && String(t).toLowerCase() === wantLabel) {
                return true;
            }
        }
        return false;
    }

    function filterResults(result, selected) {
        if (!result) {
            return result;
        }
        if (!selected || (!selected.code && !selected.label)) {
            return result;
        }
        var arr = null;
        if (Array.isArray(result)) {
            arr = result;
        } else if (result.result && Array.isArray(result.result)) {
            arr = result.result;
        } else if (result.entities && Array.isArray(result.entities)) {
            arr = result.entities;
        }
        if (!arr) {
            return result;
        }
        var kept = [];
        for (var i = 0; i < arr.length; i++) {
            if (siteMatchesSelected(arr[i], selected)) {
                kept.push(arr[i]);
            }
        }
        if (Array.isArray(result)) {
            return kept;
        }
        if (result.result) {
            result.result = kept;
        }
        if (result.entities) {
            result.entities = kept;
        }
        return result;
    }

    function tenantEntitiesBase(url) {
        var u = String(url || "");
        var idx = u.indexOf("/entities");
        if (idx === -1) {
            return u;
        }
        return u.slice(0, idx) + "/entities";
    }

    function collectEntities(result) {
        if (Array.isArray(result)) {
            return result.slice();
        }
        if (result && Array.isArray(result.result)) {
            return result.result;
        }
        if (result && Array.isArray(result.entities)) {
            return result.entities;
        }
        return [];
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

    function hydrateAndFilter(result, selected, searchUrl, tenant, headers, status, respHeaders, callback) {
        var arr = collectEntities(result);
        if (!selected || (!selected.code && !selected.label)) {
            if (typeof callback === "function") {
                callback(result, status, respHeaders);
            }
            return;
        }
        if (!arr.length) {
            if (typeof callback === "function") {
                callback(result, status, respHeaders);
            }
            return;
        }
        var base = tenantEntitiesBase(searchUrl);
        var pending = arr.length;
        var hydrated = new Array(arr.length);
        function tick() {
            pending -= 1;
            if (pending > 0) {
                return;
            }
            var kept = [];
            for (var i = 0; i < arr.length; i++) {
                var ent = hydrated[i] || arr[i];
                if (siteMatchesSelected(ent, selected)) {
                    kept.push(arr[i]);
                }
            }
            if (typeof callback === "function") {
                callback(putEntities(result, kept), status, respHeaders);
            }
        }
        for (var i = 0; i < arr.length; i++) {
            (function (idx) {
                var ent = arr[idx];
                if (resultCountryTokens(ent).length) {
                    hydrated[idx] = ent;
                    tick();
                    return;
                }
                var uri = (ent && (ent.uri || ent.entityId)) || "";
                if (!uri || !base) {
                    hydrated[idx] = ent;
                    tick();
                    return;
                }
                var id = String(uri).replace(/^entities\//, "");
                var getUrl = base + "/" + id + "?select=uri,label,secondaryLabel,type,attributes.CountryCode,attributes.Name";
                try {
                    var settled = false;
                    function got(body) {
                        if (settled) {
                            return;
                        }
                        settled = true;
                        var loaded = body;
                        if (Array.isArray(body)) {
                            loaded = body[0];
                        }
                        hydrated[idx] = loaded || ent;
                        tick();
                    }
                    var getRet = UI.api(getUrl, "GET", tenant, headers, null, got);
                    if (getRet && typeof getRet.then === "function") {
                        getRet.then(got, function () {
                            got(ent);
                        });
                    }
                } catch (e) {
                    hydrated[idx] = ent;
                    tick();
                }
            })(i);
        }
    }

    function applyTypeahead(url, verb, tenant, headers, data, parsed, urlOrParams, entity, callback) {
        var selected = pickSelected(url, parsed, urlOrParams, entity);
        if (!selected.code && !selected.label) {
            selected = { code: draftCountry.code, label: draftCountry.label };
        }
        if (!selected.code && selected.label) {
            selected.code = isoFromLabel(selected.label);
        }
        var code = selected.code || isoFromLabel(selected.label);
        var nextData = data;
        var nextUrl = url;
        if (code || selected.label) {
            var rewritten = rewriteBody(parsed || {}, code);
            if (rewritten && typeof rewritten === "object" && !Array.isArray(rewritten)) {
                nextData = typeof data === "string" ? JSON.stringify(rewritten) : rewritten;
            }
            nextUrl = rewriteUrl(url, code);
        } else {
            nextData = stripUnresolvedCountryFilter(parsed, data);
            nextUrl = stripUnresolvedCountryFilterUrl(url);
        }
        var finished = false;
        function after(result, status, respHeaders) {
            if (finished) {
                return;
            }
            finished = true;
            hydrateAndFilter(result, selected, nextUrl, tenant, headers, status || 200, respHeaders || {}, callback);
        }
        var ret = UI.api(nextUrl, verb, tenant, headers, nextData, after);
        if (ret && typeof ret.then === "function") {
            ret.then(function (result) {
                after(result, 200, {});
            });
        }
        return ret;
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
        if (type === "updateEntity" || type === "uiAction" || type === "editAttribute") {
            rememberEntity(data);
            var found = findParticipatingCountry(data, 0);
            if (found.code || found.label) {
                draftCountry = found;
            }
            if (
                data &&
                (data.lookupCode ||
                    (data.value && data.value.lookupCode) ||
                    isoFromLabel(lookupLabelFrom(data) || data.value || data))
            ) {
                rememberDraftCountry(data);
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
            if (isSiteSearch(url, parsed, urlOrParams)) {
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
                return validateLinkedSitesThenWrite(url, verb, tenant, headers, data, parsed, callback);
            }

            return UI.api(url, verb, tenant, headers, data, callback);
        } catch (err) {
            return UI.api(url, verb, tenant, headers, data, callback);
        }
    });
})();
