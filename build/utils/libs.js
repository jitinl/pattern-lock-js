"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.gcd = exports.bindContext = exports.hashCode = exports.patternToWords = void 0;

var _wordMap = _interopRequireDefault(require("./word-map.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Convert pattern to a string of random words
 * 
 * @param {Array<{ row: Number, col: Number }>} nodes
 * 
 * @returns {String}
 */
var patternToWords = function patternToWords(nodes) {
  return nodes.reduce(function () {
    var string = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var node = arguments.length > 1 ? arguments[1] : undefined;
    return _wordMap.default[node.row - 1][node.col - 1] + string;
  });
};
/**
 * Hashcode algorithm implementation
 * 
 * @param {String} str
 * 
 * @returns {String}
 */


exports.patternToWords = patternToWords;

var hashCode = function hashCode(str) {
  if (!str.length) return '';
  var hash = str.split('').reduce(function () {
    var a = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    var b = arguments.length > 1 ? arguments[1] : undefined;
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  });
  return btoa(hash + '');
};

exports.hashCode = hashCode;

var bindContext = function bindContext(ctx, fns) {
  return fns.forEach(function (fnName) {
    return ctx[fnName] = ctx[fnName] && ctx[fnName].bind(ctx);
  });
};

exports.bindContext = bindContext;

var gcd = function gcd(x, y) {
  while (y != 0) {
    var tmp = x;
    x = y;
    y = tmp % y;
  }

  return x;
};

exports.gcd = gcd;