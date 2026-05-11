"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_STATUS = exports.USER_ROLES = void 0;
var USER_ROLES;
(function (USER_ROLES) {
    USER_ROLES["SUPER_ADMIN"] = "SUPER_ADMIN";
    USER_ROLES["USER"] = "USER";
})(USER_ROLES || (exports.USER_ROLES = USER_ROLES = {}));
var USER_STATUS;
(function (USER_STATUS) {
    USER_STATUS["ACTIVE"] = "ACTIVE";
    USER_STATUS["INACTIVE"] = "INACTIVE";
    USER_STATUS["RESTRICTED"] = "RESTRICTED";
    // Key renamed to `DELETED` (past-participle). Stored value stays
    // `'DELETE'` for DB backwards compatibility.
    USER_STATUS["DELETED"] = "DELETE";
})(USER_STATUS || (exports.USER_STATUS = USER_STATUS = {}));
