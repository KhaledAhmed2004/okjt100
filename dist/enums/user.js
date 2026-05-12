"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_STATUS = exports.USER_ROLES = void 0;
var USER_ROLES;
(function (USER_ROLES) {
    USER_ROLES["SUPER_ADMIN"] = "SUPER_ADMIN";
    USER_ROLES["BROTHER"] = "BROTHER";
    USER_ROLES["SISTER"] = "SISTER";
})(USER_ROLES || (exports.USER_ROLES = USER_ROLES = {}));
var USER_STATUS;
(function (USER_STATUS) {
    USER_STATUS["PENDING"] = "PENDING";
    USER_STATUS["ACTIVE"] = "ACTIVE";
    USER_STATUS["INACTIVE"] = "INACTIVE";
    USER_STATUS["RESTRICTED"] = "RESTRICTED";
    USER_STATUS["REJECTED"] = "REJECTED";
    USER_STATUS["SUSPENDED"] = "SUSPENDED";
    USER_STATUS["DELETED"] = "DELETE";
})(USER_STATUS || (exports.USER_STATUS = USER_STATUS = {}));
