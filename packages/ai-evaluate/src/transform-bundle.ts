/**
 * Bundled sucrase transformer for src/transform.ts
 *
 * GENERATED FILE - do not edit. Regenerate with:
 *   npx tsx scripts/build-transform-bundle.ts
 *
 * Embeds sucrase@3.35.1 (MIT, https://github.com/alangpierce/sucrase) as a
 * self-contained ES module so the JSX/TypeScript transform runs inside the
 * worker that runs evaluate(), with no Node-side compiler.
 */
/* eslint-disable */
// @ts-nocheck
var l;
(function(e) {
  e[e.NONE = 0] = "NONE";
  const s = 1;
  e[e._abstract = s] = "_abstract";
  const o = s + 1;
  e[e._accessor = o] = "_accessor";
  const i = o + 1;
  e[e._as = i] = "_as";
  const c = i + 1;
  e[e._assert = c] = "_assert";
  const h = c + 1;
  e[e._asserts = h] = "_asserts";
  const m = h + 1;
  e[e._async = m] = "_async";
  const g = m + 1;
  e[e._await = g] = "_await";
  const f = g + 1;
  e[e._checks = f] = "_checks";
  const y = f + 1;
  e[e._constructor = y] = "_constructor";
  const T = y + 1;
  e[e._declare = T] = "_declare";
  const S = T + 1;
  e[e._enum = S] = "_enum";
  const C = S + 1;
  e[e._exports = C] = "_exports";
  const U = C + 1;
  e[e._from = U] = "_from";
  const V = U + 1;
  e[e._get = V] = "_get";
  const re = V + 1;
  e[e._global = re] = "_global";
  const ie = re + 1;
  e[e._implements = ie] = "_implements";
  const N = ie + 1;
  e[e._infer = N] = "_infer";
  const O = N + 1;
  e[e._interface = O] = "_interface";
  const R = O + 1;
  e[e._is = R] = "_is";
  const Y = R + 1;
  e[e._keyof = Y] = "_keyof";
  const te = Y + 1;
  e[e._mixins = te] = "_mixins";
  const X = te + 1;
  e[e._module = X] = "_module";
  const ae = X + 1;
  e[e._namespace = ae] = "_namespace";
  const de = ae + 1;
  e[e._of = de] = "_of";
  const he = de + 1;
  e[e._opaque = he] = "_opaque";
  const pe = he + 1;
  e[e._out = pe] = "_out";
  const ve = pe + 1;
  e[e._override = ve] = "_override";
  const Be = ve + 1;
  e[e._private = Be] = "_private";
  const De = Be + 1;
  e[e._protected = De] = "_protected";
  const Ue = De + 1;
  e[e._proto = Ue] = "_proto";
  const Oe = Ue + 1;
  e[e._public = Oe] = "_public";
  const Fe = Oe + 1;
  e[e._readonly = Fe] = "_readonly";
  const ee = Fe + 1;
  e[e._require = ee] = "_require";
  const $e = ee + 1;
  e[e._satisfies = $e] = "_satisfies";
  const je = $e + 1;
  e[e._set = je] = "_set";
  const He = je + 1;
  e[e._static = He] = "_static";
  const Ne = He + 1;
  e[e._symbol = Ne] = "_symbol";
  const qe = Ne + 1;
  e[e._type = qe] = "_type";
  const Ve = qe + 1;
  e[e._unique = Ve] = "_unique";
  const _ = Ve + 1;
  e[e._using = _] = "_using";
})(l || (l = {}));
var t;
(function(e) {
  e[e.PRECEDENCE_MASK = 15] = "PRECEDENCE_MASK";
  const s = 16;
  e[e.IS_KEYWORD = s] = "IS_KEYWORD";
  const o = 32;
  e[e.IS_ASSIGN = o] = "IS_ASSIGN";
  const i = 64;
  e[e.IS_RIGHT_ASSOCIATIVE = i] = "IS_RIGHT_ASSOCIATIVE";
  const c = 128;
  e[e.IS_PREFIX = c] = "IS_PREFIX";
  const h = 256;
  e[e.IS_POSTFIX = h] = "IS_POSTFIX";
  const m = 512;
  e[e.IS_EXPRESSION_START = m] = "IS_EXPRESSION_START";
  const g = 512;
  e[e.num = g] = "num";
  const f = 1536;
  e[e.bigint = f] = "bigint";
  const y = 2560;
  e[e.decimal = y] = "decimal";
  const T = 3584;
  e[e.regexp = T] = "regexp";
  const S = 4608;
  e[e.string = S] = "string";
  const C = 5632;
  e[e.name = C] = "name";
  const U = 6144;
  e[e.eof = U] = "eof";
  const V = 7680;
  e[e.bracketL = V] = "bracketL";
  const re = 8192;
  e[e.bracketR = re] = "bracketR";
  const ie = 9728;
  e[e.braceL = ie] = "braceL";
  const N = 10752;
  e[e.braceBarL = N] = "braceBarL";
  const O = 11264;
  e[e.braceR = O] = "braceR";
  const R = 12288;
  e[e.braceBarR = R] = "braceBarR";
  const Y = 13824;
  e[e.parenL = Y] = "parenL";
  const te = 14336;
  e[e.parenR = te] = "parenR";
  const X = 15360;
  e[e.comma = X] = "comma";
  const ae = 16384;
  e[e.semi = ae] = "semi";
  const de = 17408;
  e[e.colon = de] = "colon";
  const he = 18432;
  e[e.doubleColon = he] = "doubleColon";
  const pe = 19456;
  e[e.dot = pe] = "dot";
  const ve = 20480;
  e[e.question = ve] = "question";
  const Be = 21504;
  e[e.questionDot = Be] = "questionDot";
  const De = 22528;
  e[e.arrow = De] = "arrow";
  const Ue = 23552;
  e[e.template = Ue] = "template";
  const Oe = 24576;
  e[e.ellipsis = Oe] = "ellipsis";
  const Fe = 25600;
  e[e.backQuote = Fe] = "backQuote";
  const ee = 27136;
  e[e.dollarBraceL = ee] = "dollarBraceL";
  const $e = 27648;
  e[e.at = $e] = "at";
  const je = 29184;
  e[e.hash = je] = "hash";
  const He = 29728;
  e[e.eq = He] = "eq";
  const Ne = 30752;
  e[e.assign = Ne] = "assign";
  const qe = 32640;
  e[e.preIncDec = qe] = "preIncDec";
  const Ve = 33664;
  e[e.postIncDec = Ve] = "postIncDec";
  const _ = 34432;
  e[e.bang = _] = "bang";
  const x = 35456;
  e[e.tilde = x] = "tilde";
  const I = 35841;
  e[e.pipeline = I] = "pipeline";
  const w = 36866;
  e[e.nullishCoalescing = w] = "nullishCoalescing";
  const A = 37890;
  e[e.logicalOR = A] = "logicalOR";
  const L = 38915;
  e[e.logicalAND = L] = "logicalAND";
  const D = 39940;
  e[e.bitwiseOR = D] = "bitwiseOR";
  const $ = 40965;
  e[e.bitwiseXOR = $] = "bitwiseXOR";
  const Q = 41990;
  e[e.bitwiseAND = Q] = "bitwiseAND";
  const z = 43015;
  e[e.equality = z] = "equality";
  const ce = 44040;
  e[e.lessThan = ce] = "lessThan";
  const _e = 45064;
  e[e.greaterThan = _e] = "greaterThan";
  const ne = 46088;
  e[e.relationalOrEqual = ne] = "relationalOrEqual";
  const fe = 47113;
  e[e.bitShiftL = fe] = "bitShiftL";
  const me = 48137;
  e[e.bitShiftR = me] = "bitShiftR";
  const Qe = 49802;
  e[e.plus = Qe] = "plus";
  const ot = 50826;
  e[e.minus = ot] = "minus";
  const pt = 51723;
  e[e.modulo = pt] = "modulo";
  const nn = 52235;
  e[e.star = nn] = "star";
  const sn = 53259;
  e[e.slash = sn] = "slash";
  const rn = 54348;
  e[e.exponent = rn] = "exponent";
  const on = 55296;
  e[e.jsxName = on] = "jsxName";
  const an = 56320;
  e[e.jsxText = an] = "jsxText";
  const cn = 57344;
  e[e.jsxEmptyText = cn] = "jsxEmptyText";
  const ln = 58880;
  e[e.jsxTagStart = ln] = "jsxTagStart";
  const un = 59392;
  e[e.jsxTagEnd = un] = "jsxTagEnd";
  const hn = 60928;
  e[e.typeParameterStart = hn] = "typeParameterStart";
  const pn = 61440;
  e[e.nonNullAssertion = pn] = "nonNullAssertion";
  const fn = 62480;
  e[e._break = fn] = "_break";
  const mn = 63504;
  e[e._case = mn] = "_case";
  const dn = 64528;
  e[e._catch = dn] = "_catch";
  const kn = 65552;
  e[e._continue = kn] = "_continue";
  const gn = 66576;
  e[e._debugger = gn] = "_debugger";
  const _n = 67600;
  e[e._default = _n] = "_default";
  const xn = 68624;
  e[e._do = xn] = "_do";
  const yn = 69648;
  e[e._else = yn] = "_else";
  const In = 70672;
  e[e._finally = In] = "_finally";
  const bn = 71696;
  e[e._for = bn] = "_for";
  const wn = 73232;
  e[e._function = wn] = "_function";
  const Tn = 73744;
  e[e._if = Tn] = "_if";
  const An = 74768;
  e[e._return = An] = "_return";
  const En = 75792;
  e[e._switch = En] = "_switch";
  const Sn = 77456;
  e[e._throw = Sn] = "_throw";
  const vn = 77840;
  e[e._try = vn] = "_try";
  const Nn = 78864;
  e[e._var = Nn] = "_var";
  const Cn = 79888;
  e[e._let = Cn] = "_let";
  const Pn = 80912;
  e[e._const = Pn] = "_const";
  const Rn = 81936;
  e[e._while = Rn] = "_while";
  const Ln = 82960;
  e[e._with = Ln] = "_with";
  const Dn = 84496;
  e[e._new = Dn] = "_new";
  const On = 85520;
  e[e._this = On] = "_this";
  const Fn = 86544;
  e[e._super = Fn] = "_super";
  const jn = 87568;
  e[e._class = jn] = "_class";
  const qn = 88080;
  e[e._extends = qn] = "_extends";
  const Mn = 89104;
  e[e._export = Mn] = "_export";
  const Bn = 90640;
  e[e._import = Bn] = "_import";
  const Un = 91664;
  e[e._yield = Un] = "_yield";
  const $n = 92688;
  e[e._null = $n] = "_null";
  const Hn = 93712;
  e[e._true = Hn] = "_true";
  const Vn = 94736;
  e[e._false = Vn] = "_false";
  const Wn = 95256;
  e[e._in = Wn] = "_in";
  const Xn = 96280;
  e[e._instanceof = Xn] = "_instanceof";
  const Gn = 97936;
  e[e._typeof = Gn] = "_typeof";
  const zn = 98960;
  e[e._void = zn] = "_void";
  const Sr = 99984;
  e[e._delete = Sr] = "_delete";
  const vr = 100880;
  e[e._async = vr] = "_async";
  const Nr = 101904;
  e[e._get = Nr] = "_get";
  const Cr = 102928;
  e[e._set = Cr] = "_set";
  const Pr = 103952;
  e[e._declare = Pr] = "_declare";
  const Rr = 104976;
  e[e._readonly = Rr] = "_readonly";
  const Lr = 106e3;
  e[e._abstract = Lr] = "_abstract";
  const Dr = 107024;
  e[e._static = Dr] = "_static";
  const Or = 107536;
  e[e._public = Or] = "_public";
  const Fr = 108560;
  e[e._private = Fr] = "_private";
  const jr = 109584;
  e[e._protected = jr] = "_protected";
  const qr = 110608;
  e[e._override = qr] = "_override";
  const Mr = 112144;
  e[e._as = Mr] = "_as";
  const Br = 113168;
  e[e._enum = Br] = "_enum";
  const Ur = 114192;
  e[e._type = Ur] = "_type";
  const $r = 115216;
  e[e._implements = $r] = "_implements";
})(t || (t = {}));
function Hr(e) {
  switch (e) {
    case t.num:
      return "num";
    case t.bigint:
      return "bigint";
    case t.decimal:
      return "decimal";
    case t.regexp:
      return "regexp";
    case t.string:
      return "string";
    case t.name:
      return "name";
    case t.eof:
      return "eof";
    case t.bracketL:
      return "[";
    case t.bracketR:
      return "]";
    case t.braceL:
      return "{";
    case t.braceBarL:
      return "{|";
    case t.braceR:
      return "}";
    case t.braceBarR:
      return "|}";
    case t.parenL:
      return "(";
    case t.parenR:
      return ")";
    case t.comma:
      return ",";
    case t.semi:
      return ";";
    case t.colon:
      return ":";
    case t.doubleColon:
      return "::";
    case t.dot:
      return ".";
    case t.question:
      return "?";
    case t.questionDot:
      return "?.";
    case t.arrow:
      return "=>";
    case t.template:
      return "template";
    case t.ellipsis:
      return "...";
    case t.backQuote:
      return "`";
    case t.dollarBraceL:
      return "${";
    case t.at:
      return "@";
    case t.hash:
      return "#";
    case t.eq:
      return "=";
    case t.assign:
      return "_=";
    case t.preIncDec:
      return "++/--";
    case t.postIncDec:
      return "++/--";
    case t.bang:
      return "!";
    case t.tilde:
      return "~";
    case t.pipeline:
      return "|>";
    case t.nullishCoalescing:
      return "??";
    case t.logicalOR:
      return "||";
    case t.logicalAND:
      return "&&";
    case t.bitwiseOR:
      return "|";
    case t.bitwiseXOR:
      return "^";
    case t.bitwiseAND:
      return "&";
    case t.equality:
      return "==/!=";
    case t.lessThan:
      return "<";
    case t.greaterThan:
      return ">";
    case t.relationalOrEqual:
      return "<=/>=";
    case t.bitShiftL:
      return "<<";
    case t.bitShiftR:
      return ">>/>>>";
    case t.plus:
      return "+";
    case t.minus:
      return "-";
    case t.modulo:
      return "%";
    case t.star:
      return "*";
    case t.slash:
      return "/";
    case t.exponent:
      return "**";
    case t.jsxName:
      return "jsxName";
    case t.jsxText:
      return "jsxText";
    case t.jsxEmptyText:
      return "jsxEmptyText";
    case t.jsxTagStart:
      return "jsxTagStart";
    case t.jsxTagEnd:
      return "jsxTagEnd";
    case t.typeParameterStart:
      return "typeParameterStart";
    case t.nonNullAssertion:
      return "nonNullAssertion";
    case t._break:
      return "break";
    case t._case:
      return "case";
    case t._catch:
      return "catch";
    case t._continue:
      return "continue";
    case t._debugger:
      return "debugger";
    case t._default:
      return "default";
    case t._do:
      return "do";
    case t._else:
      return "else";
    case t._finally:
      return "finally";
    case t._for:
      return "for";
    case t._function:
      return "function";
    case t._if:
      return "if";
    case t._return:
      return "return";
    case t._switch:
      return "switch";
    case t._throw:
      return "throw";
    case t._try:
      return "try";
    case t._var:
      return "var";
    case t._let:
      return "let";
    case t._const:
      return "const";
    case t._while:
      return "while";
    case t._with:
      return "with";
    case t._new:
      return "new";
    case t._this:
      return "this";
    case t._super:
      return "super";
    case t._class:
      return "class";
    case t._extends:
      return "extends";
    case t._export:
      return "export";
    case t._import:
      return "import";
    case t._yield:
      return "yield";
    case t._null:
      return "null";
    case t._true:
      return "true";
    case t._false:
      return "false";
    case t._in:
      return "in";
    case t._instanceof:
      return "instanceof";
    case t._typeof:
      return "typeof";
    case t._void:
      return "void";
    case t._delete:
      return "delete";
    case t._async:
      return "async";
    case t._get:
      return "get";
    case t._set:
      return "set";
    case t._declare:
      return "declare";
    case t._readonly:
      return "readonly";
    case t._abstract:
      return "abstract";
    case t._static:
      return "static";
    case t._public:
      return "public";
    case t._private:
      return "private";
    case t._protected:
      return "protected";
    case t._override:
      return "override";
    case t._as:
      return "as";
    case t._enum:
      return "enum";
    case t._type:
      return "type";
    case t._implements:
      return "implements";
    default:
      return "";
  }
}
class Re {
  constructor(n, s, o) {
    this.startTokenIndex = n, this.endTokenIndex = s, this.isFunctionScope = o;
  }
}
class Vr {
  constructor(n, s, o, i, c, h, m, g, f, y, T, S, C) {
    this.potentialArrowAt = n, this.noAnonFunctionType = s, this.inDisallowConditionalTypesContext = o, this.tokensLength = i, this.scopesLength = c, this.pos = h, this.type = m, this.contextualKeyword = g, this.start = f, this.end = y, this.isType = T, this.scopeDepth = S, this.error = C;
  }
}
class ke {
  constructor() {
    ke.prototype.__init.call(this), ke.prototype.__init2.call(this), ke.prototype.__init3.call(this), ke.prototype.__init4.call(this), ke.prototype.__init5.call(this), ke.prototype.__init6.call(this), ke.prototype.__init7.call(this), ke.prototype.__init8.call(this), ke.prototype.__init9.call(this), ke.prototype.__init10.call(this), ke.prototype.__init11.call(this), ke.prototype.__init12.call(this), ke.prototype.__init13.call(this);
  }
  // Used to signify the start of a potential arrow function
  __init() {
    this.potentialArrowAt = -1;
  }
  // Used by Flow to handle an edge case involving function type parsing.
  __init2() {
    this.noAnonFunctionType = !1;
  }
  // Used by TypeScript to handle ambiguities when parsing conditional types.
  __init3() {
    this.inDisallowConditionalTypesContext = !1;
  }
  // Token store.
  __init4() {
    this.tokens = [];
  }
  // Array of all observed scopes, ordered by their ending position.
  __init5() {
    this.scopes = [];
  }
  // The current position of the tokenizer in the input.
  __init6() {
    this.pos = 0;
  }
  // Information about the current token.
  __init7() {
    this.type = t.eof;
  }
  __init8() {
    this.contextualKeyword = l.NONE;
  }
  __init9() {
    this.start = 0;
  }
  __init10() {
    this.end = 0;
  }
  __init11() {
    this.isType = !1;
  }
  __init12() {
    this.scopeDepth = 0;
  }
  /**
   * If the parser is in an error state, then the token is always tt.eof and all functions can
   * keep executing but should be written so they don't get into an infinite loop in this situation.
   *
   * This approach, combined with the ability to snapshot and restore state, allows us to implement
   * backtracking without exceptions and without needing to explicitly propagate error states
   * everywhere.
   */
  __init13() {
    this.error = null;
  }
  snapshot() {
    return new Vr(
      this.potentialArrowAt,
      this.noAnonFunctionType,
      this.inDisallowConditionalTypesContext,
      this.tokens.length,
      this.scopes.length,
      this.pos,
      this.type,
      this.contextualKeyword,
      this.start,
      this.end,
      this.isType,
      this.scopeDepth,
      this.error
    );
  }
  restoreFromSnapshot(n) {
    this.potentialArrowAt = n.potentialArrowAt, this.noAnonFunctionType = n.noAnonFunctionType, this.inDisallowConditionalTypesContext = n.inDisallowConditionalTypesContext, this.tokens.length = n.tokensLength, this.scopes.length = n.scopesLength, this.pos = n.pos, this.type = n.type, this.contextualKeyword = n.contextualKeyword, this.start = n.start, this.end = n.end, this.isType = n.isType, this.scopeDepth = n.scopeDepth, this.error = n.error;
  }
}
var u;
(function(e) {
  e[e.backSpace = 8] = "backSpace";
  const s = 10;
  e[e.lineFeed = s] = "lineFeed";
  const o = 9;
  e[e.tab = o] = "tab";
  const i = 13;
  e[e.carriageReturn = i] = "carriageReturn";
  const c = 14;
  e[e.shiftOut = c] = "shiftOut";
  const h = 32;
  e[e.space = h] = "space";
  const m = 33;
  e[e.exclamationMark = m] = "exclamationMark";
  const g = 34;
  e[e.quotationMark = g] = "quotationMark";
  const f = 35;
  e[e.numberSign = f] = "numberSign";
  const y = 36;
  e[e.dollarSign = y] = "dollarSign";
  const T = 37;
  e[e.percentSign = T] = "percentSign";
  const S = 38;
  e[e.ampersand = S] = "ampersand";
  const C = 39;
  e[e.apostrophe = C] = "apostrophe";
  const U = 40;
  e[e.leftParenthesis = U] = "leftParenthesis";
  const V = 41;
  e[e.rightParenthesis = V] = "rightParenthesis";
  const re = 42;
  e[e.asterisk = re] = "asterisk";
  const ie = 43;
  e[e.plusSign = ie] = "plusSign";
  const N = 44;
  e[e.comma = N] = "comma";
  const O = 45;
  e[e.dash = O] = "dash";
  const R = 46;
  e[e.dot = R] = "dot";
  const Y = 47;
  e[e.slash = Y] = "slash";
  const te = 48;
  e[e.digit0 = te] = "digit0";
  const X = 49;
  e[e.digit1 = X] = "digit1";
  const ae = 50;
  e[e.digit2 = ae] = "digit2";
  const de = 51;
  e[e.digit3 = de] = "digit3";
  const he = 52;
  e[e.digit4 = he] = "digit4";
  const pe = 53;
  e[e.digit5 = pe] = "digit5";
  const ve = 54;
  e[e.digit6 = ve] = "digit6";
  const Be = 55;
  e[e.digit7 = Be] = "digit7";
  const De = 56;
  e[e.digit8 = De] = "digit8";
  const Ue = 57;
  e[e.digit9 = Ue] = "digit9";
  const Oe = 58;
  e[e.colon = Oe] = "colon";
  const Fe = 59;
  e[e.semicolon = Fe] = "semicolon";
  const ee = 60;
  e[e.lessThan = ee] = "lessThan";
  const $e = 61;
  e[e.equalsTo = $e] = "equalsTo";
  const je = 62;
  e[e.greaterThan = je] = "greaterThan";
  const He = 63;
  e[e.questionMark = He] = "questionMark";
  const Ne = 64;
  e[e.atSign = Ne] = "atSign";
  const qe = 65;
  e[e.uppercaseA = qe] = "uppercaseA";
  const Ve = 66;
  e[e.uppercaseB = Ve] = "uppercaseB";
  const _ = 67;
  e[e.uppercaseC = _] = "uppercaseC";
  const x = 68;
  e[e.uppercaseD = x] = "uppercaseD";
  const I = 69;
  e[e.uppercaseE = I] = "uppercaseE";
  const w = 70;
  e[e.uppercaseF = w] = "uppercaseF";
  const A = 71;
  e[e.uppercaseG = A] = "uppercaseG";
  const L = 72;
  e[e.uppercaseH = L] = "uppercaseH";
  const D = 73;
  e[e.uppercaseI = D] = "uppercaseI";
  const $ = 74;
  e[e.uppercaseJ = $] = "uppercaseJ";
  const Q = 75;
  e[e.uppercaseK = Q] = "uppercaseK";
  const z = 76;
  e[e.uppercaseL = z] = "uppercaseL";
  const ce = 77;
  e[e.uppercaseM = ce] = "uppercaseM";
  const _e = 78;
  e[e.uppercaseN = _e] = "uppercaseN";
  const ne = 79;
  e[e.uppercaseO = ne] = "uppercaseO";
  const fe = 80;
  e[e.uppercaseP = fe] = "uppercaseP";
  const me = 81;
  e[e.uppercaseQ = me] = "uppercaseQ";
  const Qe = 82;
  e[e.uppercaseR = Qe] = "uppercaseR";
  const ot = 83;
  e[e.uppercaseS = ot] = "uppercaseS";
  const pt = 84;
  e[e.uppercaseT = pt] = "uppercaseT";
  const nn = 85;
  e[e.uppercaseU = nn] = "uppercaseU";
  const sn = 86;
  e[e.uppercaseV = sn] = "uppercaseV";
  const rn = 87;
  e[e.uppercaseW = rn] = "uppercaseW";
  const on = 88;
  e[e.uppercaseX = on] = "uppercaseX";
  const an = 89;
  e[e.uppercaseY = an] = "uppercaseY";
  const cn = 90;
  e[e.uppercaseZ = cn] = "uppercaseZ";
  const ln = 91;
  e[e.leftSquareBracket = ln] = "leftSquareBracket";
  const un = 92;
  e[e.backslash = un] = "backslash";
  const hn = 93;
  e[e.rightSquareBracket = hn] = "rightSquareBracket";
  const pn = 94;
  e[e.caret = pn] = "caret";
  const fn = 95;
  e[e.underscore = fn] = "underscore";
  const mn = 96;
  e[e.graveAccent = mn] = "graveAccent";
  const dn = 97;
  e[e.lowercaseA = dn] = "lowercaseA";
  const kn = 98;
  e[e.lowercaseB = kn] = "lowercaseB";
  const gn = 99;
  e[e.lowercaseC = gn] = "lowercaseC";
  const _n = 100;
  e[e.lowercaseD = _n] = "lowercaseD";
  const xn = 101;
  e[e.lowercaseE = xn] = "lowercaseE";
  const yn = 102;
  e[e.lowercaseF = yn] = "lowercaseF";
  const In = 103;
  e[e.lowercaseG = In] = "lowercaseG";
  const bn = 104;
  e[e.lowercaseH = bn] = "lowercaseH";
  const wn = 105;
  e[e.lowercaseI = wn] = "lowercaseI";
  const Tn = 106;
  e[e.lowercaseJ = Tn] = "lowercaseJ";
  const An = 107;
  e[e.lowercaseK = An] = "lowercaseK";
  const En = 108;
  e[e.lowercaseL = En] = "lowercaseL";
  const Sn = 109;
  e[e.lowercaseM = Sn] = "lowercaseM";
  const vn = 110;
  e[e.lowercaseN = vn] = "lowercaseN";
  const Nn = 111;
  e[e.lowercaseO = Nn] = "lowercaseO";
  const Cn = 112;
  e[e.lowercaseP = Cn] = "lowercaseP";
  const Pn = 113;
  e[e.lowercaseQ = Pn] = "lowercaseQ";
  const Rn = 114;
  e[e.lowercaseR = Rn] = "lowercaseR";
  const Ln = 115;
  e[e.lowercaseS = Ln] = "lowercaseS";
  const Dn = 116;
  e[e.lowercaseT = Dn] = "lowercaseT";
  const On = 117;
  e[e.lowercaseU = On] = "lowercaseU";
  const Fn = 118;
  e[e.lowercaseV = Fn] = "lowercaseV";
  const jn = 119;
  e[e.lowercaseW = jn] = "lowercaseW";
  const qn = 120;
  e[e.lowercaseX = qn] = "lowercaseX";
  const Mn = 121;
  e[e.lowercaseY = Mn] = "lowercaseY";
  const Bn = 122;
  e[e.lowercaseZ = Bn] = "lowercaseZ";
  const Un = 123;
  e[e.leftCurlyBrace = Un] = "leftCurlyBrace";
  const $n = 124;
  e[e.verticalBar = $n] = "verticalBar";
  const Hn = 125;
  e[e.rightCurlyBrace = Hn] = "rightCurlyBrace";
  const Vn = 126;
  e[e.tilde = Vn] = "tilde";
  const Wn = 160;
  e[e.nonBreakingSpace = Wn] = "nonBreakingSpace";
  const Xn = 5760;
  e[e.oghamSpaceMark = Xn] = "oghamSpaceMark";
  const Gn = 8232;
  e[e.lineSeparator = Gn] = "lineSeparator";
  const zn = 8233;
  e[e.paragraphSeparator = zn] = "paragraphSeparator";
})(u || (u = {}));
let zt, B, H, r, b, k1;
function yt() {
  return k1++;
}
function Wr(e) {
  if ("pos" in e) {
    const n = Gr(e.pos);
    e.message += ` (${n.line}:${n.column})`, e.loc = n;
  }
  return e;
}
class Xr {
  constructor(n, s) {
    this.line = n, this.column = s;
  }
}
function Gr(e) {
  let n = 1, s = 1;
  for (let o = 0; o < e; o++)
    b.charCodeAt(o) === u.lineFeed ? (n++, s = 1) : s++;
  return new Xr(n, s);
}
function zr(e, n, s, o) {
  b = e, r = new ke(), k1 = 1, zt = n, B = s, H = o;
}
function E(e) {
  return r.contextualKeyword === e;
}
function fs(e) {
  const n = St();
  return n.type === t.name && n.contextualKeyword === e;
}
function oe(e) {
  return r.contextualKeyword === e && p(t.name);
}
function se(e) {
  oe(e) || j();
}
function ye() {
  return a(t.eof) || a(t.braceR) || ge();
}
function ge() {
  const e = r.tokens[r.tokens.length - 1], n = e ? e.end : 0;
  for (let s = n; s < r.start; s++) {
    const o = b.charCodeAt(s);
    if (o === u.lineFeed || o === u.carriageReturn || o === 8232 || o === 8233)
      return !0;
  }
  return !1;
}
function g1() {
  const e = ms();
  for (let n = r.end; n < e; n++) {
    const s = b.charCodeAt(n);
    if (s === u.lineFeed || s === u.carriageReturn || s === 8232 || s === 8233)
      return !0;
  }
  return !1;
}
function Ce() {
  return p(t.semi) || ye();
}
function J() {
  Ce() || j('Unexpected token, expected ";"');
}
function d(e) {
  p(e) || j(`Unexpected token, expected "${Hr(e)}"`);
}
function j(e = "Unexpected token", n = r.start) {
  if (r.error)
    return;
  const s = new SyntaxError(e);
  s.pos = n, r.error = s, r.pos = b.length, F(t.eof);
}
const _1 = [
  9,
  11,
  12,
  u.space,
  u.nonBreakingSpace,
  u.oghamSpaceMark,
  8192,
  // EN QUAD
  8193,
  // EM QUAD
  8194,
  // EN SPACE
  8195,
  // EM SPACE
  8196,
  // THREE-PER-EM SPACE
  8197,
  // FOUR-PER-EM SPACE
  8198,
  // SIX-PER-EM SPACE
  8199,
  // FIGURE SPACE
  8200,
  // PUNCTUATION SPACE
  8201,
  // THIN SPACE
  8202,
  // HAIR SPACE
  8239,
  // NARROW NO-BREAK SPACE
  8287,
  // MEDIUM MATHEMATICAL SPACE
  12288,
  // IDEOGRAPHIC SPACE
  65279
  // ZERO WIDTH NO-BREAK SPACE
], Us = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g, x1 = new Uint8Array(65536);
for (const e of _1)
  x1[e] = 1;
function Jr(e) {
  if (e < 48) return e === 36;
  if (e < 58) return !0;
  if (e < 65) return !1;
  if (e < 91) return !0;
  if (e < 97) return e === 95;
  if (e < 123) return !0;
  if (e < 128) return !1;
  throw new Error("Should not be called with non-ASCII char code.");
}
const Ae = new Uint8Array(65536);
for (let e = 0; e < 128; e++)
  Ae[e] = Jr(e) ? 1 : 0;
for (let e = 128; e < 65536; e++)
  Ae[e] = 1;
for (const e of _1)
  Ae[e] = 0;
Ae[8232] = 0;
Ae[8233] = 0;
const Et = Ae.slice();
for (let e = u.digit0; e <= u.digit9; e++)
  Et[e] = 0;
const $s = new Int32Array([
  // ""
  -1,
  27,
  783,
  918,
  1755,
  2376,
  2862,
  3483,
  -1,
  3699,
  -1,
  4617,
  4752,
  4833,
  5130,
  5508,
  5940,
  -1,
  6480,
  6939,
  7749,
  8181,
  8451,
  8613,
  -1,
  8829,
  -1,
  // "a"
  -1,
  -1,
  54,
  243,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  432,
  -1,
  -1,
  -1,
  675,
  -1,
  -1,
  -1,
  // "ab"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  81,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "abs"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  108,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "abst"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  135,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "abstr"
  -1,
  162,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "abstra"
  -1,
  -1,
  -1,
  189,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "abstrac"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  216,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "abstract"
  l._abstract << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ac"
  -1,
  -1,
  -1,
  270,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "acc"
  -1,
  -1,
  -1,
  -1,
  -1,
  297,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "acce"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  324,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "acces"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  351,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "access"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  378,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "accesso"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  405,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "accessor"
  l._accessor << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "as"
  l._as << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  459,
  -1,
  -1,
  -1,
  -1,
  -1,
  594,
  -1,
  // "ass"
  -1,
  -1,
  -1,
  -1,
  -1,
  486,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "asse"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  513,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "asser"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  540,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "assert"
  l._assert << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  567,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "asserts"
  l._asserts << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "asy"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  621,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "asyn"
  -1,
  -1,
  -1,
  648,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "async"
  l._async << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "aw"
  -1,
  702,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "awa"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  729,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "awai"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  756,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "await"
  l._await << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "b"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  810,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "br"
  -1,
  -1,
  -1,
  -1,
  -1,
  837,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "bre"
  -1,
  864,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "brea"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  891,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "break"
  (t._break << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "c"
  -1,
  945,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1107,
  -1,
  -1,
  -1,
  1242,
  -1,
  -1,
  1350,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ca"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  972,
  1026,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "cas"
  -1,
  -1,
  -1,
  -1,
  -1,
  999,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "case"
  (t._case << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "cat"
  -1,
  -1,
  -1,
  1053,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "catc"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1080,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "catch"
  (t._catch << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ch"
  -1,
  -1,
  -1,
  -1,
  -1,
  1134,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "che"
  -1,
  -1,
  -1,
  1161,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "chec"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1188,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "check"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1215,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "checks"
  l._checks << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "cl"
  -1,
  1269,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "cla"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1296,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "clas"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1323,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "class"
  (t._class << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "co"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1377,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "con"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1404,
  1620,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "cons"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1431,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "const"
  (t._const << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1458,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "constr"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1485,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "constru"
  -1,
  -1,
  -1,
  1512,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "construc"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1539,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "construct"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1566,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "constructo"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1593,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "constructor"
  l._constructor << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "cont"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1647,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "conti"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1674,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "contin"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1701,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "continu"
  -1,
  -1,
  -1,
  -1,
  -1,
  1728,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "continue"
  (t._continue << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "d"
  -1,
  -1,
  -1,
  -1,
  -1,
  1782,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2349,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "de"
  -1,
  -1,
  1809,
  1971,
  -1,
  -1,
  2106,
  -1,
  -1,
  -1,
  -1,
  -1,
  2241,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "deb"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1836,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "debu"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1863,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "debug"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1890,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "debugg"
  -1,
  -1,
  -1,
  -1,
  -1,
  1917,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "debugge"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1944,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "debugger"
  (t._debugger << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "dec"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  1998,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "decl"
  -1,
  2025,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "decla"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2052,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "declar"
  -1,
  -1,
  -1,
  -1,
  -1,
  2079,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "declare"
  l._declare << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "def"
  -1,
  2133,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "defa"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2160,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "defau"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2187,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "defaul"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2214,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "default"
  (t._default << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "del"
  -1,
  -1,
  -1,
  -1,
  -1,
  2268,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "dele"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2295,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "delet"
  -1,
  -1,
  -1,
  -1,
  -1,
  2322,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "delete"
  (t._delete << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "do"
  (t._do << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "e"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2403,
  -1,
  2484,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2565,
  -1,
  -1,
  // "el"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2430,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "els"
  -1,
  -1,
  -1,
  -1,
  -1,
  2457,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "else"
  (t._else << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "en"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2511,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "enu"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2538,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "enum"
  l._enum << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ex"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2592,
  -1,
  -1,
  -1,
  2727,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "exp"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2619,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "expo"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2646,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "expor"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2673,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "export"
  (t._export << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2700,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "exports"
  l._exports << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ext"
  -1,
  -1,
  -1,
  -1,
  -1,
  2754,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "exte"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2781,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "exten"
  -1,
  -1,
  -1,
  -1,
  2808,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "extend"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2835,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "extends"
  (t._extends << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "f"
  -1,
  2889,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2997,
  -1,
  -1,
  -1,
  -1,
  -1,
  3159,
  -1,
  -1,
  3213,
  -1,
  -1,
  3294,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "fa"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2916,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "fal"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2943,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "fals"
  -1,
  -1,
  -1,
  -1,
  -1,
  2970,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "false"
  (t._false << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "fi"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3024,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "fin"
  -1,
  3051,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "fina"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3078,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "final"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3105,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "finall"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3132,
  -1,
  // "finally"
  (t._finally << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "fo"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3186,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "for"
  (t._for << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "fr"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3240,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "fro"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3267,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "from"
  l._from << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "fu"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3321,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "fun"
  -1,
  -1,
  -1,
  3348,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "func"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3375,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "funct"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3402,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "functi"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3429,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "functio"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3456,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "function"
  (t._function << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "g"
  -1,
  -1,
  -1,
  -1,
  -1,
  3510,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3564,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ge"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3537,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "get"
  l._get << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "gl"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3591,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "glo"
  -1,
  -1,
  3618,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "glob"
  -1,
  3645,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "globa"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3672,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "global"
  l._global << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "i"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3726,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3753,
  4077,
  -1,
  -1,
  -1,
  -1,
  4590,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "if"
  (t._if << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "im"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3780,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "imp"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3807,
  -1,
  -1,
  3996,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "impl"
  -1,
  -1,
  -1,
  -1,
  -1,
  3834,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "imple"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3861,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "implem"
  -1,
  -1,
  -1,
  -1,
  -1,
  3888,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "impleme"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3915,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "implemen"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3942,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "implement"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  3969,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "implements"
  l._implements << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "impo"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4023,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "impor"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4050,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "import"
  (t._import << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "in"
  (t._in << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4104,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4185,
  4401,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "inf"
  -1,
  -1,
  -1,
  -1,
  -1,
  4131,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "infe"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4158,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "infer"
  l._infer << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ins"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4212,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "inst"
  -1,
  4239,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "insta"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4266,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "instan"
  -1,
  -1,
  -1,
  4293,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "instanc"
  -1,
  -1,
  -1,
  -1,
  -1,
  4320,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "instance"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4347,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "instanceo"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4374,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "instanceof"
  (t._instanceof << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "int"
  -1,
  -1,
  -1,
  -1,
  -1,
  4428,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "inte"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4455,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "inter"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4482,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "interf"
  -1,
  4509,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "interfa"
  -1,
  -1,
  -1,
  4536,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "interfac"
  -1,
  -1,
  -1,
  -1,
  -1,
  4563,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "interface"
  l._interface << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "is"
  l._is << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "k"
  -1,
  -1,
  -1,
  -1,
  -1,
  4644,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ke"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4671,
  -1,
  // "key"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4698,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "keyo"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4725,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "keyof"
  l._keyof << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "l"
  -1,
  -1,
  -1,
  -1,
  -1,
  4779,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "le"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4806,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "let"
  (t._let << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "m"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4860,
  -1,
  -1,
  -1,
  -1,
  -1,
  4995,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "mi"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4887,
  -1,
  -1,
  // "mix"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4914,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "mixi"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4941,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "mixin"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  4968,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "mixins"
  l._mixins << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "mo"
  -1,
  -1,
  -1,
  -1,
  5022,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "mod"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5049,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "modu"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5076,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "modul"
  -1,
  -1,
  -1,
  -1,
  -1,
  5103,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "module"
  l._module << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "n"
  -1,
  5157,
  -1,
  -1,
  -1,
  5373,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5427,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "na"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5184,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "nam"
  -1,
  -1,
  -1,
  -1,
  -1,
  5211,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "name"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5238,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "names"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5265,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "namesp"
  -1,
  5292,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "namespa"
  -1,
  -1,
  -1,
  5319,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "namespac"
  -1,
  -1,
  -1,
  -1,
  -1,
  5346,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "namespace"
  l._namespace << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ne"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5400,
  -1,
  -1,
  -1,
  // "new"
  (t._new << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "nu"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5454,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "nul"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5481,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "null"
  (t._null << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "o"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5535,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5562,
  -1,
  -1,
  -1,
  -1,
  5697,
  5751,
  -1,
  -1,
  -1,
  -1,
  // "of"
  l._of << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "op"
  -1,
  5589,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "opa"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5616,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "opaq"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5643,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "opaqu"
  -1,
  -1,
  -1,
  -1,
  -1,
  5670,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "opaque"
  l._opaque << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ou"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5724,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "out"
  l._out << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ov"
  -1,
  -1,
  -1,
  -1,
  -1,
  5778,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ove"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5805,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "over"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5832,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "overr"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5859,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "overri"
  -1,
  -1,
  -1,
  -1,
  5886,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "overrid"
  -1,
  -1,
  -1,
  -1,
  -1,
  5913,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "override"
  l._override << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "p"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5967,
  -1,
  -1,
  6345,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "pr"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  5994,
  -1,
  -1,
  -1,
  -1,
  -1,
  6129,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "pri"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6021,
  -1,
  -1,
  -1,
  -1,
  // "priv"
  -1,
  6048,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "priva"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6075,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "privat"
  -1,
  -1,
  -1,
  -1,
  -1,
  6102,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "private"
  l._private << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "pro"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6156,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "prot"
  -1,
  -1,
  -1,
  -1,
  -1,
  6183,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6318,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "prote"
  -1,
  -1,
  -1,
  6210,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "protec"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6237,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "protect"
  -1,
  -1,
  -1,
  -1,
  -1,
  6264,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "protecte"
  -1,
  -1,
  -1,
  -1,
  6291,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "protected"
  l._protected << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "proto"
  l._proto << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "pu"
  -1,
  -1,
  6372,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "pub"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6399,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "publ"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6426,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "publi"
  -1,
  -1,
  -1,
  6453,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "public"
  l._public << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "r"
  -1,
  -1,
  -1,
  -1,
  -1,
  6507,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "re"
  -1,
  6534,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6696,
  -1,
  -1,
  6831,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "rea"
  -1,
  -1,
  -1,
  -1,
  6561,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "read"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6588,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "reado"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6615,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "readon"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6642,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "readonl"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6669,
  -1,
  // "readonly"
  l._readonly << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "req"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6723,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "requ"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6750,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "requi"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6777,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "requir"
  -1,
  -1,
  -1,
  -1,
  -1,
  6804,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "require"
  l._require << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ret"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6858,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "retu"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6885,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "retur"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6912,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "return"
  (t._return << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "s"
  -1,
  6966,
  -1,
  -1,
  -1,
  7182,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7236,
  7371,
  -1,
  7479,
  -1,
  7614,
  -1,
  // "sa"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  6993,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "sat"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7020,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "sati"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7047,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "satis"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7074,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "satisf"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7101,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "satisfi"
  -1,
  -1,
  -1,
  -1,
  -1,
  7128,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "satisfie"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7155,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "satisfies"
  l._satisfies << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "se"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7209,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "set"
  l._set << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "st"
  -1,
  7263,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "sta"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7290,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "stat"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7317,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "stati"
  -1,
  -1,
  -1,
  7344,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "static"
  l._static << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "su"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7398,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "sup"
  -1,
  -1,
  -1,
  -1,
  -1,
  7425,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "supe"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7452,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "super"
  (t._super << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "sw"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7506,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "swi"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7533,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "swit"
  -1,
  -1,
  -1,
  7560,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "switc"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7587,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "switch"
  (t._switch << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "sy"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7641,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "sym"
  -1,
  -1,
  7668,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "symb"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7695,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "symbo"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7722,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "symbol"
  l._symbol << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "t"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7776,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7938,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8046,
  -1,
  // "th"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7803,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7857,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "thi"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7830,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "this"
  (t._this << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "thr"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7884,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "thro"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7911,
  -1,
  -1,
  -1,
  // "throw"
  (t._throw << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "tr"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  7965,
  -1,
  -1,
  -1,
  8019,
  -1,
  // "tru"
  -1,
  -1,
  -1,
  -1,
  -1,
  7992,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "true"
  (t._true << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "try"
  (t._try << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "ty"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8073,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "typ"
  -1,
  -1,
  -1,
  -1,
  -1,
  8100,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "type"
  l._type << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8127,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "typeo"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8154,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "typeof"
  (t._typeof << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "u"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8208,
  -1,
  -1,
  -1,
  -1,
  8343,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "un"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8235,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "uni"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8262,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "uniq"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8289,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "uniqu"
  -1,
  -1,
  -1,
  -1,
  -1,
  8316,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "unique"
  l._unique << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "us"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8370,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "usi"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8397,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "usin"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8424,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "using"
  l._using << 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "v"
  -1,
  8478,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8532,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "va"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8505,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "var"
  (t._var << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "vo"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8559,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "voi"
  -1,
  -1,
  -1,
  -1,
  8586,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "void"
  (t._void << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "w"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8640,
  8748,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "wh"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8667,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "whi"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8694,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "whil"
  -1,
  -1,
  -1,
  -1,
  -1,
  8721,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "while"
  (t._while << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "wi"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8775,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "wit"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8802,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "with"
  (t._with << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "y"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8856,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "yi"
  -1,
  -1,
  -1,
  -1,
  -1,
  8883,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "yie"
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8910,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "yiel"
  -1,
  -1,
  -1,
  -1,
  8937,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  // "yield"
  (t._yield << 1) + 1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1
]);
function Qr() {
  let e = 0, n = 0, s = r.pos;
  for (; s < b.length && (n = b.charCodeAt(s), !(n < u.lowercaseA || n > u.lowercaseZ)); ) {
    const i = $s[e + (n - u.lowercaseA) + 1];
    if (i === -1)
      break;
    e = i, s++;
  }
  const o = $s[e];
  if (o > -1 && !Ae[n]) {
    r.pos = s, o & 1 ? F(o >>> 1) : F(t.name, o >>> 1);
    return;
  }
  for (; s < b.length; ) {
    const i = b.charCodeAt(s);
    if (Ae[i])
      s++;
    else if (i === u.backslash) {
      if (s += 2, b.charCodeAt(s) === u.leftCurlyBrace) {
        for (; s < b.length && b.charCodeAt(s) !== u.rightCurlyBrace; )
          s++;
        s++;
      }
    } else if (i === u.atSign && b.charCodeAt(s + 1) === u.atSign)
      s += 2;
    else
      break;
  }
  r.pos = s, F(t.name);
}
var v;
(function(e) {
  e[e.Access = 0] = "Access";
  const s = 1;
  e[e.ExportAccess = s] = "ExportAccess";
  const o = s + 1;
  e[e.TopLevelDeclaration = o] = "TopLevelDeclaration";
  const i = o + 1;
  e[e.FunctionScopedDeclaration = i] = "FunctionScopedDeclaration";
  const c = i + 1;
  e[e.BlockScopedDeclaration = c] = "BlockScopedDeclaration";
  const h = c + 1;
  e[e.ObjectShorthandTopLevelDeclaration = h] = "ObjectShorthandTopLevelDeclaration";
  const m = h + 1;
  e[e.ObjectShorthandFunctionScopedDeclaration = m] = "ObjectShorthandFunctionScopedDeclaration";
  const g = m + 1;
  e[e.ObjectShorthandBlockScopedDeclaration = g] = "ObjectShorthandBlockScopedDeclaration";
  const f = g + 1;
  e[e.ObjectShorthand = f] = "ObjectShorthand";
  const y = f + 1;
  e[e.ImportDeclaration = y] = "ImportDeclaration";
  const T = y + 1;
  e[e.ObjectKey = T] = "ObjectKey";
  const S = T + 1;
  e[e.ImportAccess = S] = "ImportAccess";
})(v || (v = {}));
var Te;
(function(e) {
  e[e.NoChildren = 0] = "NoChildren";
  const s = 1;
  e[e.OneChild = s] = "OneChild";
  const o = s + 1;
  e[e.StaticChildren = o] = "StaticChildren";
  const i = o + 1;
  e[e.KeyAfterPropSpread = i] = "KeyAfterPropSpread";
})(Te || (Te = {}));
function y1(e) {
  const n = e.identifierRole;
  return n === v.TopLevelDeclaration || n === v.FunctionScopedDeclaration || n === v.BlockScopedDeclaration || n === v.ObjectShorthandTopLevelDeclaration || n === v.ObjectShorthandFunctionScopedDeclaration || n === v.ObjectShorthandBlockScopedDeclaration;
}
function Yr(e) {
  const n = e.identifierRole;
  return n === v.FunctionScopedDeclaration || n === v.BlockScopedDeclaration || n === v.ObjectShorthandFunctionScopedDeclaration || n === v.ObjectShorthandBlockScopedDeclaration;
}
function I1(e) {
  const n = e.identifierRole;
  return n === v.TopLevelDeclaration || n === v.ObjectShorthandTopLevelDeclaration || n === v.ImportDeclaration;
}
function Zr(e) {
  const n = e.identifierRole;
  return n === v.TopLevelDeclaration || n === v.BlockScopedDeclaration || n === v.ObjectShorthandTopLevelDeclaration || n === v.ObjectShorthandBlockScopedDeclaration;
}
function Kr(e) {
  const n = e.identifierRole;
  return n === v.FunctionScopedDeclaration || n === v.ObjectShorthandFunctionScopedDeclaration;
}
function eo(e) {
  return e.identifierRole === v.ObjectShorthandTopLevelDeclaration || e.identifierRole === v.ObjectShorthandBlockScopedDeclaration || e.identifierRole === v.ObjectShorthandFunctionScopedDeclaration;
}
class Jt {
  constructor() {
    this.type = r.type, this.contextualKeyword = r.contextualKeyword, this.start = r.start, this.end = r.end, this.scopeDepth = r.scopeDepth, this.isType = r.isType, this.identifierRole = null, this.jsxRole = null, this.shadowsGlobal = !1, this.isAsyncOperation = !1, this.contextId = null, this.rhsEndIndex = null, this.isExpression = !1, this.numNullishCoalesceStarts = 0, this.numNullishCoalesceEnds = 0, this.isOptionalChainStart = !1, this.isOptionalChainEnd = !1, this.subscriptStartIndex = null, this.nullishStartIndex = null;
  }
  // Initially false for all tokens, then may be computed in a follow-up step that does scope
  // analysis.
  // Initially false for all tokens, but may be set during transform to mark it as containing an
  // await operation.
  // For assignments, the index of the RHS. For export tokens, the end of the export.
  // For class tokens, records if the class is a class expression or a class statement.
  // Number of times to insert a `nullishCoalesce(` snippet before this token.
  // Number of times to insert a `)` snippet after this token.
  // If true, insert an `optionalChain([` snippet before this token.
  // If true, insert a `])` snippet after this token.
  // Tag for `.`, `?.`, `[`, `?.[`, `(`, and `?.(` to denote the "root" token for this
  // subscript chain. This can be used to determine if this chain is an optional chain.
  // Tag for `??` operators to denote the root token for this nullish coalescing call.
}
function k() {
  r.tokens.push(new Jt()), A1();
}
function We() {
  r.tokens.push(new Jt()), r.start = r.pos, _o();
}
function to() {
  r.type === t.assign && --r.pos, mo();
}
function M(e) {
  for (let s = r.tokens.length - e; s < r.tokens.length; s++)
    r.tokens[s].isType = !0;
  const n = r.isType;
  return r.isType = !0, n;
}
function q(e) {
  r.isType = e;
}
function p(e) {
  return a(e) ? (k(), !0) : !1;
}
function b1(e) {
  const n = r.isType;
  r.isType = !0, p(e), r.isType = n;
}
function a(e) {
  return r.type === e;
}
function Z() {
  const e = r.snapshot();
  k();
  const n = r.type;
  return r.restoreFromSnapshot(e), n;
}
class no {
  constructor(n, s) {
    this.type = n, this.contextualKeyword = s;
  }
}
function St() {
  const e = r.snapshot();
  k();
  const n = r.type, s = r.contextualKeyword;
  return r.restoreFromSnapshot(e), new no(n, s);
}
function ms() {
  return w1(r.pos);
}
function w1(e) {
  Us.lastIndex = e;
  const n = Us.exec(b);
  return e + n[0].length;
}
function T1() {
  return b.charCodeAt(ms());
}
function A1() {
  if (S1(), r.start = r.pos, r.pos >= b.length) {
    const e = r.tokens;
    e.length >= 2 && e[e.length - 1].start >= b.length && e[e.length - 2].start >= b.length && j("Unexpectedly reached the end of input."), F(t.eof);
    return;
  }
  so(b.charCodeAt(r.pos));
}
function so(e) {
  Et[e] || e === u.backslash || e === u.atSign && b.charCodeAt(r.pos + 1) === u.atSign ? Qr() : C1(e);
}
function ro() {
  for (; b.charCodeAt(r.pos) !== u.asterisk || b.charCodeAt(r.pos + 1) !== u.slash; )
    if (r.pos++, r.pos > b.length) {
      j("Unterminated comment", r.pos - 2);
      return;
    }
  r.pos += 2;
}
function E1(e) {
  let n = b.charCodeAt(r.pos += e);
  if (r.pos < b.length)
    for (; n !== u.lineFeed && n !== u.carriageReturn && n !== u.lineSeparator && n !== u.paragraphSeparator && ++r.pos < b.length; )
      n = b.charCodeAt(r.pos);
}
function S1() {
  for (; r.pos < b.length; ) {
    const e = b.charCodeAt(r.pos);
    switch (e) {
      case u.carriageReturn:
        b.charCodeAt(r.pos + 1) === u.lineFeed && ++r.pos;
      case u.lineFeed:
      case u.lineSeparator:
      case u.paragraphSeparator:
        ++r.pos;
        break;
      case u.slash:
        switch (b.charCodeAt(r.pos + 1)) {
          case u.asterisk:
            r.pos += 2, ro();
            break;
          case u.slash:
            E1(2);
            break;
          default:
            return;
        }
        break;
      default:
        if (x1[e])
          ++r.pos;
        else
          return;
    }
  }
}
function F(e, n = l.NONE) {
  r.end = r.pos, r.type = e, r.contextualKeyword = n;
}
function oo() {
  const e = b.charCodeAt(r.pos + 1);
  if (e >= u.digit0 && e <= u.digit9) {
    P1(!0);
    return;
  }
  e === u.dot && b.charCodeAt(r.pos + 2) === u.dot ? (r.pos += 3, F(t.ellipsis)) : (++r.pos, F(t.dot));
}
function io() {
  b.charCodeAt(r.pos + 1) === u.equalsTo ? W(t.assign, 2) : W(t.slash, 1);
}
function ao(e) {
  let n = e === u.asterisk ? t.star : t.modulo, s = 1, o = b.charCodeAt(r.pos + 1);
  e === u.asterisk && o === u.asterisk && (s++, o = b.charCodeAt(r.pos + 2), n = t.exponent), o === u.equalsTo && b.charCodeAt(r.pos + 2) !== u.greaterThan && (s++, n = t.assign), W(n, s);
}
function co(e) {
  const n = b.charCodeAt(r.pos + 1);
  if (n === e) {
    b.charCodeAt(r.pos + 2) === u.equalsTo ? W(t.assign, 3) : W(e === u.verticalBar ? t.logicalOR : t.logicalAND, 2);
    return;
  }
  if (e === u.verticalBar) {
    if (n === u.greaterThan) {
      W(t.pipeline, 2);
      return;
    } else if (n === u.rightCurlyBrace && H) {
      W(t.braceBarR, 2);
      return;
    }
  }
  if (n === u.equalsTo) {
    W(t.assign, 2);
    return;
  }
  W(e === u.verticalBar ? t.bitwiseOR : t.bitwiseAND, 1);
}
function lo() {
  b.charCodeAt(r.pos + 1) === u.equalsTo ? W(t.assign, 2) : W(t.bitwiseXOR, 1);
}
function uo(e) {
  const n = b.charCodeAt(r.pos + 1);
  if (n === e) {
    W(t.preIncDec, 2);
    return;
  }
  n === u.equalsTo ? W(t.assign, 2) : e === u.plusSign ? W(t.plus, 1) : W(t.minus, 1);
}
function ho() {
  const e = b.charCodeAt(r.pos + 1);
  if (e === u.lessThan) {
    if (b.charCodeAt(r.pos + 2) === u.equalsTo) {
      W(t.assign, 3);
      return;
    }
    r.isType ? W(t.lessThan, 1) : W(t.bitShiftL, 2);
    return;
  }
  e === u.equalsTo ? W(t.relationalOrEqual, 2) : W(t.lessThan, 1);
}
function v1() {
  if (r.isType) {
    W(t.greaterThan, 1);
    return;
  }
  const e = b.charCodeAt(r.pos + 1);
  if (e === u.greaterThan) {
    const n = b.charCodeAt(r.pos + 2) === u.greaterThan ? 3 : 2;
    if (b.charCodeAt(r.pos + n) === u.equalsTo) {
      W(t.assign, n + 1);
      return;
    }
    W(t.bitShiftR, n);
    return;
  }
  e === u.equalsTo ? W(t.relationalOrEqual, 2) : W(t.greaterThan, 1);
}
function N1() {
  r.type === t.greaterThan && (r.pos -= 1, v1());
}
function po(e) {
  const n = b.charCodeAt(r.pos + 1);
  if (n === u.equalsTo) {
    W(t.equality, b.charCodeAt(r.pos + 2) === u.equalsTo ? 3 : 2);
    return;
  }
  if (e === u.equalsTo && n === u.greaterThan) {
    r.pos += 2, F(t.arrow);
    return;
  }
  W(e === u.equalsTo ? t.eq : t.bang, 1);
}
function fo() {
  const e = b.charCodeAt(r.pos + 1), n = b.charCodeAt(r.pos + 2);
  e === u.questionMark && // In Flow (but not TypeScript), ??string is a valid type that should be
  // tokenized as two individual ? tokens.
  !(H && r.isType) ? n === u.equalsTo ? W(t.assign, 3) : W(t.nullishCoalescing, 2) : e === u.dot && !(n >= u.digit0 && n <= u.digit9) ? (r.pos += 2, F(t.questionDot)) : (++r.pos, F(t.question));
}
function C1(e) {
  switch (e) {
    case u.numberSign:
      ++r.pos, F(t.hash);
      return;
    // The interpretation of a dot depends on whether it is followed
    // by a digit or another two dots.
    case u.dot:
      oo();
      return;
    // Punctuation tokens.
    case u.leftParenthesis:
      ++r.pos, F(t.parenL);
      return;
    case u.rightParenthesis:
      ++r.pos, F(t.parenR);
      return;
    case u.semicolon:
      ++r.pos, F(t.semi);
      return;
    case u.comma:
      ++r.pos, F(t.comma);
      return;
    case u.leftSquareBracket:
      ++r.pos, F(t.bracketL);
      return;
    case u.rightSquareBracket:
      ++r.pos, F(t.bracketR);
      return;
    case u.leftCurlyBrace:
      H && b.charCodeAt(r.pos + 1) === u.verticalBar ? W(t.braceBarL, 2) : (++r.pos, F(t.braceL));
      return;
    case u.rightCurlyBrace:
      ++r.pos, F(t.braceR);
      return;
    case u.colon:
      b.charCodeAt(r.pos + 1) === u.colon ? W(t.doubleColon, 2) : (++r.pos, F(t.colon));
      return;
    case u.questionMark:
      fo();
      return;
    case u.atSign:
      ++r.pos, F(t.at);
      return;
    case u.graveAccent:
      ++r.pos, F(t.backQuote);
      return;
    case u.digit0: {
      const n = b.charCodeAt(r.pos + 1);
      if (n === u.lowercaseX || n === u.uppercaseX || n === u.lowercaseO || n === u.uppercaseO || n === u.lowercaseB || n === u.uppercaseB) {
        ko();
        return;
      }
    }
    // Anything else beginning with a digit is an integer, octal
    // number, or float.
    case u.digit1:
    case u.digit2:
    case u.digit3:
    case u.digit4:
    case u.digit5:
    case u.digit6:
    case u.digit7:
    case u.digit8:
    case u.digit9:
      P1(!1);
      return;
    // Quotes produce strings.
    case u.quotationMark:
    case u.apostrophe:
      go(e);
      return;
    // Operators are parsed inline in tiny state machines. '=' (charCodes.equalsTo) is
    // often referred to. `finishOp` simply skips the amount of
    // characters it is given as second argument, and returns a token
    // of the type given by its first argument.
    case u.slash:
      io();
      return;
    case u.percentSign:
    case u.asterisk:
      ao(e);
      return;
    case u.verticalBar:
    case u.ampersand:
      co(e);
      return;
    case u.caret:
      lo();
      return;
    case u.plusSign:
    case u.dash:
      uo(e);
      return;
    case u.lessThan:
      ho();
      return;
    case u.greaterThan:
      v1();
      return;
    case u.equalsTo:
    case u.exclamationMark:
      po(e);
      return;
    case u.tilde:
      W(t.tilde, 1);
      return;
  }
  j(`Unexpected character '${String.fromCharCode(e)}'`, r.pos);
}
function W(e, n) {
  r.pos += n, F(e);
}
function mo() {
  const e = r.pos;
  let n = !1, s = !1;
  for (; ; ) {
    if (r.pos >= b.length) {
      j("Unterminated regular expression", e);
      return;
    }
    const o = b.charCodeAt(r.pos);
    if (n)
      n = !1;
    else {
      if (o === u.leftSquareBracket)
        s = !0;
      else if (o === u.rightSquareBracket && s)
        s = !1;
      else if (o === u.slash && !s)
        break;
      n = o === u.backslash;
    }
    ++r.pos;
  }
  ++r.pos, xo(), F(t.regexp);
}
function Jn() {
  for (; ; ) {
    const e = b.charCodeAt(r.pos);
    if (e >= u.digit0 && e <= u.digit9 || e === u.underscore)
      r.pos++;
    else
      break;
  }
}
function ko() {
  for (r.pos += 2; ; ) {
    const n = b.charCodeAt(r.pos);
    if (n >= u.digit0 && n <= u.digit9 || n >= u.lowercaseA && n <= u.lowercaseF || n >= u.uppercaseA && n <= u.uppercaseF || n === u.underscore)
      r.pos++;
    else
      break;
  }
  b.charCodeAt(r.pos) === u.lowercaseN ? (++r.pos, F(t.bigint)) : F(t.num);
}
function P1(e) {
  let n = !1, s = !1;
  e || Jn();
  let o = b.charCodeAt(r.pos);
  if (o === u.dot && (++r.pos, Jn(), o = b.charCodeAt(r.pos)), (o === u.uppercaseE || o === u.lowercaseE) && (o = b.charCodeAt(++r.pos), (o === u.plusSign || o === u.dash) && ++r.pos, Jn(), o = b.charCodeAt(r.pos)), o === u.lowercaseN ? (++r.pos, n = !0) : o === u.lowercaseM && (++r.pos, s = !0), n) {
    F(t.bigint);
    return;
  }
  if (s) {
    F(t.decimal);
    return;
  }
  F(t.num);
}
function go(e) {
  for (r.pos++; ; ) {
    if (r.pos >= b.length) {
      j("Unterminated string constant");
      return;
    }
    const n = b.charCodeAt(r.pos);
    if (n === u.backslash)
      r.pos++;
    else if (n === e)
      break;
    r.pos++;
  }
  r.pos++, F(t.string);
}
function _o() {
  for (; ; ) {
    if (r.pos >= b.length) {
      j("Unterminated template");
      return;
    }
    const e = b.charCodeAt(r.pos);
    if (e === u.graveAccent || e === u.dollarSign && b.charCodeAt(r.pos + 1) === u.leftCurlyBrace) {
      if (r.pos === r.start && a(t.template))
        if (e === u.dollarSign) {
          r.pos += 2, F(t.dollarBraceL);
          return;
        } else {
          ++r.pos, F(t.backQuote);
          return;
        }
      F(t.template);
      return;
    }
    e === u.backslash && r.pos++, r.pos++;
  }
}
function xo() {
  for (; r.pos < b.length; ) {
    const e = b.charCodeAt(r.pos);
    if (Ae[e])
      r.pos++;
    else if (e === u.backslash) {
      if (r.pos += 2, b.charCodeAt(r.pos) === u.leftCurlyBrace) {
        for (; r.pos < b.length && b.charCodeAt(r.pos) !== u.rightCurlyBrace; )
          r.pos++;
        r.pos++;
      }
    } else
      break;
  }
}
function It(e, n = e.currentIndex()) {
  let s = n + 1;
  if (Rt(e, s)) {
    const o = e.identifierNameAtIndex(n);
    return {
      isType: !1,
      leftName: o,
      rightName: o,
      endIndex: s
    };
  }
  if (s++, Rt(e, s))
    return {
      isType: !0,
      leftName: null,
      rightName: null,
      endIndex: s
    };
  if (s++, Rt(e, s))
    return {
      isType: !1,
      leftName: e.identifierNameAtIndex(n),
      rightName: e.identifierNameAtIndex(n + 2),
      endIndex: s
    };
  if (s++, Rt(e, s))
    return {
      isType: !0,
      leftName: null,
      rightName: null,
      endIndex: s
    };
  throw new Error(`Unexpected import/export specifier at ${n}`);
}
function Rt(e, n) {
  const s = e.tokens[n];
  return s.type === t.braceR || s.type === t.comma;
}
const yo = /* @__PURE__ */ new Map([
  ["quot", '"'],
  ["amp", "&"],
  ["apos", "'"],
  ["lt", "<"],
  ["gt", ">"],
  ["nbsp", " "],
  ["iexcl", "¡"],
  ["cent", "¢"],
  ["pound", "£"],
  ["curren", "¤"],
  ["yen", "¥"],
  ["brvbar", "¦"],
  ["sect", "§"],
  ["uml", "¨"],
  ["copy", "©"],
  ["ordf", "ª"],
  ["laquo", "«"],
  ["not", "¬"],
  ["shy", "­"],
  ["reg", "®"],
  ["macr", "¯"],
  ["deg", "°"],
  ["plusmn", "±"],
  ["sup2", "²"],
  ["sup3", "³"],
  ["acute", "´"],
  ["micro", "µ"],
  ["para", "¶"],
  ["middot", "·"],
  ["cedil", "¸"],
  ["sup1", "¹"],
  ["ordm", "º"],
  ["raquo", "»"],
  ["frac14", "¼"],
  ["frac12", "½"],
  ["frac34", "¾"],
  ["iquest", "¿"],
  ["Agrave", "À"],
  ["Aacute", "Á"],
  ["Acirc", "Â"],
  ["Atilde", "Ã"],
  ["Auml", "Ä"],
  ["Aring", "Å"],
  ["AElig", "Æ"],
  ["Ccedil", "Ç"],
  ["Egrave", "È"],
  ["Eacute", "É"],
  ["Ecirc", "Ê"],
  ["Euml", "Ë"],
  ["Igrave", "Ì"],
  ["Iacute", "Í"],
  ["Icirc", "Î"],
  ["Iuml", "Ï"],
  ["ETH", "Ð"],
  ["Ntilde", "Ñ"],
  ["Ograve", "Ò"],
  ["Oacute", "Ó"],
  ["Ocirc", "Ô"],
  ["Otilde", "Õ"],
  ["Ouml", "Ö"],
  ["times", "×"],
  ["Oslash", "Ø"],
  ["Ugrave", "Ù"],
  ["Uacute", "Ú"],
  ["Ucirc", "Û"],
  ["Uuml", "Ü"],
  ["Yacute", "Ý"],
  ["THORN", "Þ"],
  ["szlig", "ß"],
  ["agrave", "à"],
  ["aacute", "á"],
  ["acirc", "â"],
  ["atilde", "ã"],
  ["auml", "ä"],
  ["aring", "å"],
  ["aelig", "æ"],
  ["ccedil", "ç"],
  ["egrave", "è"],
  ["eacute", "é"],
  ["ecirc", "ê"],
  ["euml", "ë"],
  ["igrave", "ì"],
  ["iacute", "í"],
  ["icirc", "î"],
  ["iuml", "ï"],
  ["eth", "ð"],
  ["ntilde", "ñ"],
  ["ograve", "ò"],
  ["oacute", "ó"],
  ["ocirc", "ô"],
  ["otilde", "õ"],
  ["ouml", "ö"],
  ["divide", "÷"],
  ["oslash", "ø"],
  ["ugrave", "ù"],
  ["uacute", "ú"],
  ["ucirc", "û"],
  ["uuml", "ü"],
  ["yacute", "ý"],
  ["thorn", "þ"],
  ["yuml", "ÿ"],
  ["OElig", "Œ"],
  ["oelig", "œ"],
  ["Scaron", "Š"],
  ["scaron", "š"],
  ["Yuml", "Ÿ"],
  ["fnof", "ƒ"],
  ["circ", "ˆ"],
  ["tilde", "˜"],
  ["Alpha", "Α"],
  ["Beta", "Β"],
  ["Gamma", "Γ"],
  ["Delta", "Δ"],
  ["Epsilon", "Ε"],
  ["Zeta", "Ζ"],
  ["Eta", "Η"],
  ["Theta", "Θ"],
  ["Iota", "Ι"],
  ["Kappa", "Κ"],
  ["Lambda", "Λ"],
  ["Mu", "Μ"],
  ["Nu", "Ν"],
  ["Xi", "Ξ"],
  ["Omicron", "Ο"],
  ["Pi", "Π"],
  ["Rho", "Ρ"],
  ["Sigma", "Σ"],
  ["Tau", "Τ"],
  ["Upsilon", "Υ"],
  ["Phi", "Φ"],
  ["Chi", "Χ"],
  ["Psi", "Ψ"],
  ["Omega", "Ω"],
  ["alpha", "α"],
  ["beta", "β"],
  ["gamma", "γ"],
  ["delta", "δ"],
  ["epsilon", "ε"],
  ["zeta", "ζ"],
  ["eta", "η"],
  ["theta", "θ"],
  ["iota", "ι"],
  ["kappa", "κ"],
  ["lambda", "λ"],
  ["mu", "μ"],
  ["nu", "ν"],
  ["xi", "ξ"],
  ["omicron", "ο"],
  ["pi", "π"],
  ["rho", "ρ"],
  ["sigmaf", "ς"],
  ["sigma", "σ"],
  ["tau", "τ"],
  ["upsilon", "υ"],
  ["phi", "φ"],
  ["chi", "χ"],
  ["psi", "ψ"],
  ["omega", "ω"],
  ["thetasym", "ϑ"],
  ["upsih", "ϒ"],
  ["piv", "ϖ"],
  ["ensp", " "],
  ["emsp", " "],
  ["thinsp", " "],
  ["zwnj", "‌"],
  ["zwj", "‍"],
  ["lrm", "‎"],
  ["rlm", "‏"],
  ["ndash", "–"],
  ["mdash", "—"],
  ["lsquo", "‘"],
  ["rsquo", "’"],
  ["sbquo", "‚"],
  ["ldquo", "“"],
  ["rdquo", "”"],
  ["bdquo", "„"],
  ["dagger", "†"],
  ["Dagger", "‡"],
  ["bull", "•"],
  ["hellip", "…"],
  ["permil", "‰"],
  ["prime", "′"],
  ["Prime", "″"],
  ["lsaquo", "‹"],
  ["rsaquo", "›"],
  ["oline", "‾"],
  ["frasl", "⁄"],
  ["euro", "€"],
  ["image", "ℑ"],
  ["weierp", "℘"],
  ["real", "ℜ"],
  ["trade", "™"],
  ["alefsym", "ℵ"],
  ["larr", "←"],
  ["uarr", "↑"],
  ["rarr", "→"],
  ["darr", "↓"],
  ["harr", "↔"],
  ["crarr", "↵"],
  ["lArr", "⇐"],
  ["uArr", "⇑"],
  ["rArr", "⇒"],
  ["dArr", "⇓"],
  ["hArr", "⇔"],
  ["forall", "∀"],
  ["part", "∂"],
  ["exist", "∃"],
  ["empty", "∅"],
  ["nabla", "∇"],
  ["isin", "∈"],
  ["notin", "∉"],
  ["ni", "∋"],
  ["prod", "∏"],
  ["sum", "∑"],
  ["minus", "−"],
  ["lowast", "∗"],
  ["radic", "√"],
  ["prop", "∝"],
  ["infin", "∞"],
  ["ang", "∠"],
  ["and", "∧"],
  ["or", "∨"],
  ["cap", "∩"],
  ["cup", "∪"],
  ["int", "∫"],
  ["there4", "∴"],
  ["sim", "∼"],
  ["cong", "≅"],
  ["asymp", "≈"],
  ["ne", "≠"],
  ["equiv", "≡"],
  ["le", "≤"],
  ["ge", "≥"],
  ["sub", "⊂"],
  ["sup", "⊃"],
  ["nsub", "⊄"],
  ["sube", "⊆"],
  ["supe", "⊇"],
  ["oplus", "⊕"],
  ["otimes", "⊗"],
  ["perp", "⊥"],
  ["sdot", "⋅"],
  ["lceil", "⌈"],
  ["rceil", "⌉"],
  ["lfloor", "⌊"],
  ["rfloor", "⌋"],
  ["lang", "〈"],
  ["rang", "〉"],
  ["loz", "◊"],
  ["spades", "♠"],
  ["clubs", "♣"],
  ["hearts", "♥"],
  ["diams", "♦"]
]);
function R1(e) {
  const [n, s] = Hs(e.jsxPragma || "React.createElement"), [o, i] = Hs(e.jsxFragmentPragma || "React.Fragment");
  return { base: n, suffix: s, fragmentBase: o, fragmentSuffix: i };
}
function Hs(e) {
  let n = e.indexOf(".");
  return n === -1 && (n = e.length), [e.slice(0, n), e.slice(n)];
}
class Ee {
  // Return true if anything was processed, false otherwise.
  getPrefixCode() {
    return "";
  }
  getHoistedCode() {
    return "";
  }
  getSuffixCode() {
    return "";
  }
}
class Ye extends Ee {
  // State for calculating the line number of each JSX tag in development.
  __init() {
    this.lastLineNumber = 1;
  }
  __init2() {
    this.lastIndex = 0;
  }
  // In development, variable name holding the name of the current file.
  __init3() {
    this.filenameVarName = null;
  }
  // Mapping of claimed names for imports in the automatic transform, e,g.
  // {jsx: "_jsx"}. This determines which imports to generate in the prefix.
  __init4() {
    this.esmAutomaticImportNameResolutions = {};
  }
  // When automatically adding imports in CJS mode, we store the variable name
  // holding the imported CJS module so we can require it in the prefix.
  __init5() {
    this.cjsAutomaticModuleNameResolutions = {};
  }
  constructor(n, s, o, i, c) {
    super(), this.rootTransformer = n, this.tokens = s, this.importProcessor = o, this.nameManager = i, this.options = c, Ye.prototype.__init.call(this), Ye.prototype.__init2.call(this), Ye.prototype.__init3.call(this), Ye.prototype.__init4.call(this), Ye.prototype.__init5.call(this), this.jsxPragmaInfo = R1(c), this.isAutomaticRuntime = c.jsxRuntime === "automatic", this.jsxImportSource = c.jsxImportSource || "react";
  }
  process() {
    return this.tokens.matches1(t.jsxTagStart) ? (this.processJSXTag(), !0) : !1;
  }
  getPrefixCode() {
    let n = "";
    if (this.filenameVarName && (n += `const ${this.filenameVarName} = ${JSON.stringify(this.options.filePath || "")};`), this.isAutomaticRuntime)
      if (this.importProcessor)
        for (const [s, o] of Object.entries(this.cjsAutomaticModuleNameResolutions))
          n += `var ${o} = require("${s}");`;
      else {
        const { createElement: s, ...o } = this.esmAutomaticImportNameResolutions;
        s && (n += `import {createElement as ${s}} from "${this.jsxImportSource}";`);
        const i = Object.entries(o).map(([c, h]) => `${c} as ${h}`).join(", ");
        if (i) {
          const c = this.jsxImportSource + (this.options.production ? "/jsx-runtime" : "/jsx-dev-runtime");
          n += `import {${i}} from "${c}";`;
        }
      }
    return n;
  }
  processJSXTag() {
    const { jsxRole: n, start: s } = this.tokens.currentToken(), o = this.options.production ? null : this.getElementLocationCode(s);
    this.isAutomaticRuntime && n !== Te.KeyAfterPropSpread ? this.transformTagToJSXFunc(o, n) : this.transformTagToCreateElement(o);
  }
  getElementLocationCode(n) {
    return `lineNumber: ${this.getLineNumberForIndex(n)}`;
  }
  /**
   * Get the line number for this source position. This is calculated lazily and
   * must be called in increasing order by index.
   */
  getLineNumberForIndex(n) {
    const s = this.tokens.code;
    for (; this.lastIndex < n && this.lastIndex < s.length; )
      s[this.lastIndex] === `
` && this.lastLineNumber++, this.lastIndex++;
    return this.lastLineNumber;
  }
  /**
   * Convert the current JSX element to a call to jsx, jsxs, or jsxDEV. This is
   * the primary transformation for the automatic transform.
   *
   * Example:
   * <div a={1} key={2}>Hello{x}</div>
   * becomes
   * jsxs('div', {a: 1, children: ["Hello", x]}, 2)
   */
  transformTagToJSXFunc(n, s) {
    const o = s === Te.StaticChildren;
    this.tokens.replaceToken(this.getJSXFuncInvocationCode(o));
    let i = null;
    if (this.tokens.matches1(t.jsxTagEnd))
      this.tokens.replaceToken(`${this.getFragmentCode()}, {`), this.processAutomaticChildrenAndEndProps(s);
    else {
      if (this.processTagIntro(), this.tokens.appendCode(", {"), i = this.processProps(!0), this.tokens.matches2(t.slash, t.jsxTagEnd))
        this.tokens.appendCode("}");
      else if (this.tokens.matches1(t.jsxTagEnd))
        this.tokens.removeToken(), this.processAutomaticChildrenAndEndProps(s);
      else
        throw new Error("Expected either /> or > at the end of the tag.");
      i && this.tokens.appendCode(`, ${i}`);
    }
    for (this.options.production || (i === null && this.tokens.appendCode(", void 0"), this.tokens.appendCode(`, ${o}, ${this.getDevSource(n)}, this`)), this.tokens.removeInitialToken(); !this.tokens.matches1(t.jsxTagEnd); )
      this.tokens.removeToken();
    this.tokens.replaceToken(")");
  }
  /**
   * Convert the current JSX element to a createElement call. In the classic
   * runtime, this is the only case. In the automatic runtime, this is called
   * as a fallback in some situations.
   *
   * Example:
   * <div a={1} key={2}>Hello{x}</div>
   * becomes
   * React.createElement('div', {a: 1, key: 2}, "Hello", x)
   */
  transformTagToCreateElement(n) {
    if (this.tokens.replaceToken(this.getCreateElementInvocationCode()), this.tokens.matches1(t.jsxTagEnd))
      this.tokens.replaceToken(`${this.getFragmentCode()}, null`), this.processChildren(!0);
    else if (this.processTagIntro(), this.processPropsObjectWithDevInfo(n), !this.tokens.matches2(t.slash, t.jsxTagEnd)) if (this.tokens.matches1(t.jsxTagEnd))
      this.tokens.removeToken(), this.processChildren(!0);
    else
      throw new Error("Expected either /> or > at the end of the tag.");
    for (this.tokens.removeInitialToken(); !this.tokens.matches1(t.jsxTagEnd); )
      this.tokens.removeToken();
    this.tokens.replaceToken(")");
  }
  /**
   * Get the code for the relevant function for this context: jsx, jsxs,
   * or jsxDEV. The following open-paren is included as well.
   *
   * These functions are only used for the automatic runtime, so they are always
   * auto-imported, but the auto-import will be either CJS or ESM based on the
   * target module format.
   */
  getJSXFuncInvocationCode(n) {
    return this.options.production ? n ? this.claimAutoImportedFuncInvocation("jsxs", "/jsx-runtime") : this.claimAutoImportedFuncInvocation("jsx", "/jsx-runtime") : this.claimAutoImportedFuncInvocation("jsxDEV", "/jsx-dev-runtime");
  }
  /**
   * Return the code to use for the createElement function, e.g.
   * `React.createElement`, including the following open-paren.
   *
   * This is the main function to use for the classic runtime. For the
   * automatic runtime, this function is used as a fallback function to
   * preserve behavior when there is a prop spread followed by an explicit
   * key. In that automatic runtime case, the function should be automatically
   * imported.
   */
  getCreateElementInvocationCode() {
    if (this.isAutomaticRuntime)
      return this.claimAutoImportedFuncInvocation("createElement", "");
    {
      const { jsxPragmaInfo: n } = this;
      return `${this.importProcessor && this.importProcessor.getIdentifierReplacement(n.base) || n.base}${n.suffix}(`;
    }
  }
  /**
   * Return the code to use as the component when compiling a shorthand
   * fragment, e.g. `React.Fragment`.
   *
   * This may be called from either the classic or automatic runtime, and
   * the value should be auto-imported for the automatic runtime.
   */
  getFragmentCode() {
    if (this.isAutomaticRuntime)
      return this.claimAutoImportedName(
        "Fragment",
        this.options.production ? "/jsx-runtime" : "/jsx-dev-runtime"
      );
    {
      const { jsxPragmaInfo: n } = this;
      return (this.importProcessor && this.importProcessor.getIdentifierReplacement(n.fragmentBase) || n.fragmentBase) + n.fragmentSuffix;
    }
  }
  /**
   * Return code that invokes the given function.
   *
   * When the imports transform is enabled, use the CJSImportTransformer
   * strategy of using `.call(void 0, ...` to avoid passing a `this` value in a
   * situation that would otherwise look like a method call.
   */
  claimAutoImportedFuncInvocation(n, s) {
    const o = this.claimAutoImportedName(n, s);
    return this.importProcessor ? `${o}.call(void 0, ` : `${o}(`;
  }
  claimAutoImportedName(n, s) {
    if (this.importProcessor) {
      const o = this.jsxImportSource + s;
      return this.cjsAutomaticModuleNameResolutions[o] || (this.cjsAutomaticModuleNameResolutions[o] = this.importProcessor.getFreeIdentifierForPath(o)), `${this.cjsAutomaticModuleNameResolutions[o]}.${n}`;
    } else
      return this.esmAutomaticImportNameResolutions[n] || (this.esmAutomaticImportNameResolutions[n] = this.nameManager.claimFreeName(
        `_${n}`
      )), this.esmAutomaticImportNameResolutions[n];
  }
  /**
   * Process the first part of a tag, before any props.
   */
  processTagIntro() {
    let n = this.tokens.currentIndex() + 1;
    for (; this.tokens.tokens[n].isType || !this.tokens.matches2AtIndex(n - 1, t.jsxName, t.jsxName) && !this.tokens.matches2AtIndex(n - 1, t.greaterThan, t.jsxName) && !this.tokens.matches1AtIndex(n, t.braceL) && !this.tokens.matches1AtIndex(n, t.jsxTagEnd) && !this.tokens.matches2AtIndex(n, t.slash, t.jsxTagEnd); )
      n++;
    if (n === this.tokens.currentIndex() + 1) {
      const s = this.tokens.identifierName();
      L1(s) && this.tokens.replaceToken(`'${s}'`);
    }
    for (; this.tokens.currentIndex() < n; )
      this.rootTransformer.processToken();
  }
  /**
   * Starting at the beginning of the props, add the props argument to
   * React.createElement, including the comma before it.
   */
  processPropsObjectWithDevInfo(n) {
    const s = this.options.production ? "" : `__self: this, __source: ${this.getDevSource(n)}`;
    if (!this.tokens.matches1(t.jsxName) && !this.tokens.matches1(t.braceL)) {
      s ? this.tokens.appendCode(`, {${s}}`) : this.tokens.appendCode(", null");
      return;
    }
    this.tokens.appendCode(", {"), this.processProps(!1), s ? this.tokens.appendCode(` ${s}}`) : this.tokens.appendCode("}");
  }
  /**
   * Transform the core part of the props, assuming that a { has already been
   * inserted before us and that a } will be inserted after us.
   *
   * If extractKeyCode is true (i.e. when using any jsx... function), any prop
   * named "key" has its code captured and returned rather than being emitted to
   * the output code. This shifts line numbers, and emitting the code later will
   * correct line numbers again. If no key is found or if extractKeyCode is
   * false, this function returns null.
   */
  processProps(n) {
    let s = null;
    for (; ; ) {
      if (this.tokens.matches2(t.jsxName, t.eq)) {
        const o = this.tokens.identifierName();
        if (n && o === "key") {
          s !== null && this.tokens.appendCode(s.replace(/[^\n]/g, "")), this.tokens.removeToken(), this.tokens.removeToken();
          const i = this.tokens.snapshot();
          this.processPropValue(), s = this.tokens.dangerouslyGetAndRemoveCodeSinceSnapshot(i);
          continue;
        } else
          this.processPropName(o), this.tokens.replaceToken(": "), this.processPropValue();
      } else if (this.tokens.matches1(t.jsxName)) {
        const o = this.tokens.identifierName();
        this.processPropName(o), this.tokens.appendCode(": true");
      } else if (this.tokens.matches1(t.braceL))
        this.tokens.replaceToken(""), this.rootTransformer.processBalancedCode(), this.tokens.replaceToken("");
      else
        break;
      this.tokens.appendCode(",");
    }
    return s;
  }
  processPropName(n) {
    n.includes("-") ? this.tokens.replaceToken(`'${n}'`) : this.tokens.copyToken();
  }
  processPropValue() {
    this.tokens.matches1(t.braceL) ? (this.tokens.replaceToken(""), this.rootTransformer.processBalancedCode(), this.tokens.replaceToken("")) : this.tokens.matches1(t.jsxTagStart) ? this.processJSXTag() : this.processStringPropValue();
  }
  processStringPropValue() {
    const n = this.tokens.currentToken(), s = this.tokens.code.slice(n.start + 1, n.end - 1), o = Vs(s), i = bo(s);
    this.tokens.replaceToken(i + o);
  }
  /**
   * Starting in the middle of the props object literal, produce an additional
   * prop for the children and close the object literal.
   */
  processAutomaticChildrenAndEndProps(n) {
    n === Te.StaticChildren ? (this.tokens.appendCode(" children: ["), this.processChildren(!1), this.tokens.appendCode("]}")) : (n === Te.OneChild && this.tokens.appendCode(" children: "), this.processChildren(!1), this.tokens.appendCode("}"));
  }
  /**
   * Transform children into a comma-separated list, which will be either
   * arguments to createElement or array elements of a children prop.
   */
  processChildren(n) {
    let s = n;
    for (; ; ) {
      if (this.tokens.matches2(t.jsxTagStart, t.slash))
        return;
      let o = !1;
      if (this.tokens.matches1(t.braceL))
        this.tokens.matches2(t.braceL, t.braceR) ? (this.tokens.replaceToken(""), this.tokens.replaceToken("")) : (this.tokens.replaceToken(s ? ", " : ""), this.rootTransformer.processBalancedCode(), this.tokens.replaceToken(""), o = !0);
      else if (this.tokens.matches1(t.jsxTagStart))
        this.tokens.appendCode(s ? ", " : ""), this.processJSXTag(), o = !0;
      else if (this.tokens.matches1(t.jsxText) || this.tokens.matches1(t.jsxEmptyText))
        o = this.processChildTextElement(s);
      else
        throw new Error("Unexpected token when processing JSX children.");
      o && (s = !0);
    }
  }
  /**
   * Turn a JSX text element into a string literal, or nothing at all if the JSX
   * text resolves to the empty string.
   *
   * Returns true if a string literal is emitted, false otherwise.
   */
  processChildTextElement(n) {
    const s = this.tokens.currentToken(), o = this.tokens.code.slice(s.start, s.end), i = Vs(o), c = Io(o);
    return c === '""' ? (this.tokens.replaceToken(i), !1) : (this.tokens.replaceToken(`${n ? ", " : ""}${c}${i}`), !0);
  }
  getDevSource(n) {
    return `{fileName: ${this.getFilenameVarName()}, ${n}}`;
  }
  getFilenameVarName() {
    return this.filenameVarName || (this.filenameVarName = this.nameManager.claimFreeName("_jsxFileName")), this.filenameVarName;
  }
}
function L1(e) {
  const n = e.charCodeAt(0);
  return n >= u.lowercaseA && n <= u.lowercaseZ;
}
function Io(e) {
  let n = "", s = "", o = !1, i = !1;
  for (let c = 0; c < e.length; c++) {
    const h = e[c];
    if (h === " " || h === "	" || h === "\r")
      o || (s += h);
    else if (h === `
`)
      s = "", o = !0;
    else {
      if (i && o && (n += " "), n += s, s = "", h === "&") {
        const { entity: m, newI: g } = D1(e, c + 1);
        c = g - 1, n += m;
      } else
        n += h;
      i = !0, o = !1;
    }
  }
  return o || (n += s), JSON.stringify(n);
}
function Vs(e) {
  let n = 0, s = 0;
  for (const o of e)
    o === `
` ? (n++, s = 0) : o === " " && s++;
  return `
`.repeat(n) + " ".repeat(s);
}
function bo(e) {
  let n = "";
  for (let s = 0; s < e.length; s++) {
    const o = e[s];
    if (o === `
`)
      if (/\s/.test(e[s + 1]))
        for (n += " "; s < e.length && /\s/.test(e[s + 1]); )
          s++;
      else
        n += `
`;
    else if (o === "&") {
      const { entity: i, newI: c } = D1(e, s + 1);
      n += i, s = c - 1;
    } else
      n += o;
  }
  return JSON.stringify(n);
}
function D1(e, n) {
  let s = "", o = 0, i, c = n;
  if (e[c] === "#") {
    let h = 10;
    c++;
    let m;
    if (e[c] === "x")
      for (h = 16, c++, m = c; c < e.length && To(e.charCodeAt(c)); )
        c++;
    else
      for (m = c; c < e.length && wo(e.charCodeAt(c)); )
        c++;
    if (e[c] === ";") {
      const g = e.slice(m, c);
      g && (c++, i = String.fromCodePoint(parseInt(g, h)));
    }
  } else
    for (; c < e.length && o++ < 10; ) {
      const h = e[c];
      if (c++, h === ";") {
        i = yo.get(s);
        break;
      }
      s += h;
    }
  return i ? { entity: i, newI: c } : { entity: "&", newI: n };
}
function wo(e) {
  return e >= u.digit0 && e <= u.digit9;
}
function To(e) {
  return e >= u.digit0 && e <= u.digit9 || e >= u.lowercaseA && e <= u.lowercaseF || e >= u.uppercaseA && e <= u.uppercaseF;
}
function O1(e, n) {
  const s = R1(n), o = /* @__PURE__ */ new Set();
  for (let i = 0; i < e.tokens.length; i++) {
    const c = e.tokens[i];
    if (c.type === t.name && !c.isType && (c.identifierRole === v.Access || c.identifierRole === v.ObjectShorthand || c.identifierRole === v.ExportAccess) && !c.shadowsGlobal && o.add(e.identifierNameForToken(c)), c.type === t.jsxTagStart && o.add(s.base), c.type === t.jsxTagStart && i + 1 < e.tokens.length && e.tokens[i + 1].type === t.jsxTagEnd && (o.add(s.base), o.add(s.fragmentBase)), c.type === t.jsxName && c.identifierRole === v.Access) {
      const h = e.identifierNameForToken(c);
      (!L1(h) || e.tokens[i + 1].type === t.dot) && o.add(e.identifierNameForToken(c));
    }
  }
  return o;
}
class Ze {
  __init() {
    this.nonTypeIdentifiers = /* @__PURE__ */ new Set();
  }
  __init2() {
    this.importInfoByPath = /* @__PURE__ */ new Map();
  }
  __init3() {
    this.importsToReplace = /* @__PURE__ */ new Map();
  }
  __init4() {
    this.identifierReplacements = /* @__PURE__ */ new Map();
  }
  __init5() {
    this.exportBindingsByLocalName = /* @__PURE__ */ new Map();
  }
  constructor(n, s, o, i, c, h, m) {
    this.nameManager = n, this.tokens = s, this.enableLegacyTypeScriptModuleInterop = o, this.options = i, this.isTypeScriptTransformEnabled = c, this.keepUnusedImports = h, this.helperManager = m, Ze.prototype.__init.call(this), Ze.prototype.__init2.call(this), Ze.prototype.__init3.call(this), Ze.prototype.__init4.call(this), Ze.prototype.__init5.call(this);
  }
  preprocessTokens() {
    for (let n = 0; n < this.tokens.tokens.length; n++)
      this.tokens.matches1AtIndex(n, t._import) && !this.tokens.matches3AtIndex(n, t._import, t.name, t.eq) && this.preprocessImportAtIndex(n), this.tokens.matches1AtIndex(n, t._export) && !this.tokens.matches2AtIndex(n, t._export, t.eq) && this.preprocessExportAtIndex(n);
    this.generateImportReplacements();
  }
  /**
   * In TypeScript, import statements that only import types should be removed.
   * This includes `import {} from 'foo';`, but not `import 'foo';`.
   */
  pruneTypeOnlyImports() {
    this.nonTypeIdentifiers = O1(this.tokens, this.options);
    for (const [n, s] of this.importInfoByPath.entries()) {
      if (s.hasBareImport || s.hasStarExport || s.exportStarNames.length > 0 || s.namedExports.length > 0)
        continue;
      [
        ...s.defaultNames,
        ...s.wildcardNames,
        ...s.namedImports.map(({ localName: i }) => i)
      ].every((i) => this.shouldAutomaticallyElideImportedName(i)) && this.importsToReplace.set(n, "");
    }
  }
  shouldAutomaticallyElideImportedName(n) {
    return this.isTypeScriptTransformEnabled && !this.keepUnusedImports && !this.nonTypeIdentifiers.has(n);
  }
  generateImportReplacements() {
    for (const [n, s] of this.importInfoByPath.entries()) {
      const {
        defaultNames: o,
        wildcardNames: i,
        namedImports: c,
        namedExports: h,
        exportStarNames: m,
        hasStarExport: g
      } = s;
      if (o.length === 0 && i.length === 0 && c.length === 0 && h.length === 0 && m.length === 0 && !g) {
        this.importsToReplace.set(n, `require('${n}');`);
        continue;
      }
      const f = this.getFreeIdentifierForPath(n);
      let y;
      this.enableLegacyTypeScriptModuleInterop ? y = f : y = i.length > 0 ? i[0] : this.getFreeIdentifierForPath(n);
      let T = `var ${f} = require('${n}');`;
      if (i.length > 0)
        for (const S of i) {
          const C = this.enableLegacyTypeScriptModuleInterop ? f : `${this.helperManager.getHelperName("interopRequireWildcard")}(${f})`;
          T += ` var ${S} = ${C};`;
        }
      else m.length > 0 && y !== f ? T += ` var ${y} = ${this.helperManager.getHelperName(
        "interopRequireWildcard"
      )}(${f});` : o.length > 0 && y !== f && (T += ` var ${y} = ${this.helperManager.getHelperName(
        "interopRequireDefault"
      )}(${f});`);
      for (const { importedName: S, localName: C } of h)
        T += ` ${this.helperManager.getHelperName(
          "createNamedExportFrom"
        )}(${f}, '${C}', '${S}');`;
      for (const S of m)
        T += ` exports.${S} = ${y};`;
      g && (T += ` ${this.helperManager.getHelperName(
        "createStarExport"
      )}(${f});`), this.importsToReplace.set(n, T);
      for (const S of o)
        this.identifierReplacements.set(S, `${y}.default`);
      for (const { importedName: S, localName: C } of c)
        this.identifierReplacements.set(C, `${f}.${S}`);
    }
  }
  getFreeIdentifierForPath(n) {
    const s = n.split("/"), i = s[s.length - 1].replace(/\W/g, "");
    return this.nameManager.claimFreeName(`_${i}`);
  }
  preprocessImportAtIndex(n) {
    const s = [], o = [], i = [];
    if (n++, (this.tokens.matchesContextualAtIndex(n, l._type) || this.tokens.matches1AtIndex(n, t._typeof)) && !this.tokens.matches1AtIndex(n + 1, t.comma) && !this.tokens.matchesContextualAtIndex(n + 1, l._from) || this.tokens.matches1AtIndex(n, t.parenL))
      return;
    if (this.tokens.matches1AtIndex(n, t.name) && (s.push(this.tokens.identifierNameAtIndex(n)), n++, this.tokens.matches1AtIndex(n, t.comma) && n++), this.tokens.matches1AtIndex(n, t.star) && (n += 2, o.push(this.tokens.identifierNameAtIndex(n)), n++), this.tokens.matches1AtIndex(n, t.braceL)) {
      const m = this.getNamedImports(n + 1);
      n = m.newIndex;
      for (const g of m.namedImports)
        g.importedName === "default" ? s.push(g.localName) : i.push(g);
    }
    if (this.tokens.matchesContextualAtIndex(n, l._from) && n++, !this.tokens.matches1AtIndex(n, t.string))
      throw new Error("Expected string token at the end of import statement.");
    const c = this.tokens.stringValueAtIndex(n), h = this.getImportInfo(c);
    h.defaultNames.push(...s), h.wildcardNames.push(...o), h.namedImports.push(...i), s.length === 0 && o.length === 0 && i.length === 0 && (h.hasBareImport = !0);
  }
  preprocessExportAtIndex(n) {
    if (this.tokens.matches2AtIndex(n, t._export, t._var) || this.tokens.matches2AtIndex(n, t._export, t._let) || this.tokens.matches2AtIndex(n, t._export, t._const))
      this.preprocessVarExportAtIndex(n);
    else if (this.tokens.matches2AtIndex(n, t._export, t._function) || this.tokens.matches2AtIndex(n, t._export, t._class)) {
      const s = this.tokens.identifierNameAtIndex(n + 2);
      this.addExportBinding(s, s);
    } else if (this.tokens.matches3AtIndex(n, t._export, t.name, t._function)) {
      const s = this.tokens.identifierNameAtIndex(n + 3);
      this.addExportBinding(s, s);
    } else this.tokens.matches2AtIndex(n, t._export, t.braceL) ? this.preprocessNamedExportAtIndex(n) : this.tokens.matches2AtIndex(n, t._export, t.star) && this.preprocessExportStarAtIndex(n);
  }
  preprocessVarExportAtIndex(n) {
    let s = 0;
    for (let o = n + 2; ; o++)
      if (this.tokens.matches1AtIndex(o, t.braceL) || this.tokens.matches1AtIndex(o, t.dollarBraceL) || this.tokens.matches1AtIndex(o, t.bracketL))
        s++;
      else if (this.tokens.matches1AtIndex(o, t.braceR) || this.tokens.matches1AtIndex(o, t.bracketR))
        s--;
      else {
        if (s === 0 && !this.tokens.matches1AtIndex(o, t.name))
          break;
        if (this.tokens.matches1AtIndex(1, t.eq)) {
          const i = this.tokens.currentToken().rhsEndIndex;
          if (i == null)
            throw new Error("Expected = token with an end index.");
          o = i - 1;
        } else {
          const i = this.tokens.tokens[o];
          if (y1(i)) {
            const c = this.tokens.identifierNameAtIndex(o);
            this.identifierReplacements.set(c, `exports.${c}`);
          }
        }
      }
  }
  /**
   * Walk this export statement just in case it's an export...from statement.
   * If it is, combine it into the import info for that path. Otherwise, just
   * bail out; it'll be handled later.
   */
  preprocessNamedExportAtIndex(n) {
    n += 2;
    const { newIndex: s, namedImports: o } = this.getNamedImports(n);
    if (n = s, this.tokens.matchesContextualAtIndex(n, l._from))
      n++;
    else {
      for (const { importedName: h, localName: m } of o)
        this.addExportBinding(h, m);
      return;
    }
    if (!this.tokens.matches1AtIndex(n, t.string))
      throw new Error("Expected string token at the end of import statement.");
    const i = this.tokens.stringValueAtIndex(n);
    this.getImportInfo(i).namedExports.push(...o);
  }
  preprocessExportStarAtIndex(n) {
    let s = null;
    if (this.tokens.matches3AtIndex(n, t._export, t.star, t._as) ? (n += 3, s = this.tokens.identifierNameAtIndex(n), n += 2) : n += 3, !this.tokens.matches1AtIndex(n, t.string))
      throw new Error("Expected string token at the end of star export statement.");
    const o = this.tokens.stringValueAtIndex(n), i = this.getImportInfo(o);
    s !== null ? i.exportStarNames.push(s) : i.hasStarExport = !0;
  }
  getNamedImports(n) {
    const s = [];
    for (; ; ) {
      if (this.tokens.matches1AtIndex(n, t.braceR)) {
        n++;
        break;
      }
      const o = It(this.tokens, n);
      if (n = o.endIndex, o.isType || s.push({
        importedName: o.leftName,
        localName: o.rightName
      }), this.tokens.matches2AtIndex(n, t.comma, t.braceR)) {
        n += 2;
        break;
      } else if (this.tokens.matches1AtIndex(n, t.braceR)) {
        n++;
        break;
      } else if (this.tokens.matches1AtIndex(n, t.comma))
        n++;
      else
        throw new Error(`Unexpected token: ${JSON.stringify(this.tokens.tokens[n])}`);
    }
    return { newIndex: n, namedImports: s };
  }
  /**
   * Get a mutable import info object for this path, creating one if it doesn't
   * exist yet.
   */
  getImportInfo(n) {
    const s = this.importInfoByPath.get(n);
    if (s)
      return s;
    const o = {
      defaultNames: [],
      wildcardNames: [],
      namedImports: [],
      namedExports: [],
      hasBareImport: !1,
      exportStarNames: [],
      hasStarExport: !1
    };
    return this.importInfoByPath.set(n, o), o;
  }
  addExportBinding(n, s) {
    this.exportBindingsByLocalName.has(n) || this.exportBindingsByLocalName.set(n, []), this.exportBindingsByLocalName.get(n).push(s);
  }
  /**
   * Return the code to use for the import for this path, or the empty string if
   * the code has already been "claimed" by a previous import.
   */
  claimImportCode(n) {
    const s = this.importsToReplace.get(n);
    return this.importsToReplace.set(n, ""), s || "";
  }
  getIdentifierReplacement(n) {
    return this.identifierReplacements.get(n) || null;
  }
  /**
   * Return a string like `exports.foo = exports.bar`.
   */
  resolveExportBinding(n) {
    const s = this.exportBindingsByLocalName.get(n);
    return !s || s.length === 0 ? null : s.map((o) => `exports.${o}`).join(" = ");
  }
  /**
   * Return all imported/exported names where we might be interested in whether usages of those
   * names are shadowed.
   */
  getGlobalNames() {
    return /* @__PURE__ */ new Set([
      ...this.identifierReplacements.keys(),
      ...this.exportBindingsByLocalName.keys()
    ]);
  }
}
var Ao = 44, Eo = 59, Ws = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", F1 = new Uint8Array(64), So = new Uint8Array(128);
for (let e = 0; e < Ws.length; e++) {
  const n = Ws.charCodeAt(e);
  F1[e] = n, So[n] = e;
}
function ft(e, n, s) {
  let o = n - s;
  o = o < 0 ? -o << 1 | 1 : o << 1;
  do {
    let i = o & 31;
    o >>>= 5, o > 0 && (i |= 32), e.write(F1[i]);
  } while (o > 0);
  return n;
}
var Xs = 1024 * 16, Gs = typeof TextDecoder < "u" ? /* @__PURE__ */ new TextDecoder() : typeof Buffer < "u" ? {
  decode(e) {
    return Buffer.from(e.buffer, e.byteOffset, e.byteLength).toString();
  }
} : {
  decode(e) {
    let n = "";
    for (let s = 0; s < e.length; s++)
      n += String.fromCharCode(e[s]);
    return n;
  }
}, vo = class {
  constructor() {
    this.pos = 0, this.out = "", this.buffer = new Uint8Array(Xs);
  }
  write(e) {
    const { buffer: n } = this;
    n[this.pos++] = e, this.pos === Xs && (this.out += Gs.decode(n), this.pos = 0);
  }
  flush() {
    const { buffer: e, out: n, pos: s } = this;
    return s > 0 ? n + Gs.decode(e.subarray(0, s)) : n;
  }
};
function No(e) {
  const n = new vo();
  let s = 0, o = 0, i = 0, c = 0;
  for (let h = 0; h < e.length; h++) {
    const m = e[h];
    if (h > 0 && n.write(Eo), m.length === 0) continue;
    let g = 0;
    for (let f = 0; f < m.length; f++) {
      const y = m[f];
      f > 0 && n.write(Ao), g = ft(n, y[0], g), y.length !== 1 && (s = ft(n, y[1], s), o = ft(n, y[2], o), i = ft(n, y[3], i), y.length !== 4 && (c = ft(n, y[4], c)));
    }
  }
  return n.flush();
}
var Dt = { exports: {} }, Co = Dt.exports, zs;
function Po() {
  return zs || (zs = 1, (function(e, n) {
    (function(s, o) {
      e.exports = o();
    })(Co, (function() {
      const s = /^[\w+.-]+:\/\//, o = /^([\w+.-]+:)\/\/([^@/#?]*@)?([^:/#?]*)(:\d+)?(\/[^#?]*)?(\?[^#]*)?(#.*)?/, i = /^file:(?:\/\/((?![a-z]:)[^/#?]*)?)?(\/?[^#?]*)(\?[^#]*)?(#.*)?/i;
      function c(N) {
        return s.test(N);
      }
      function h(N) {
        return N.startsWith("//");
      }
      function m(N) {
        return N.startsWith("/");
      }
      function g(N) {
        return N.startsWith("file:");
      }
      function f(N) {
        return /^[.?#]/.test(N);
      }
      function y(N) {
        const O = o.exec(N);
        return S(O[1], O[2] || "", O[3], O[4] || "", O[5] || "/", O[6] || "", O[7] || "");
      }
      function T(N) {
        const O = i.exec(N), R = O[2];
        return S("file:", "", O[1] || "", "", m(R) ? R : "/" + R, O[3] || "", O[4] || "");
      }
      function S(N, O, R, Y, te, X, ae) {
        return {
          scheme: N,
          user: O,
          host: R,
          port: Y,
          path: te,
          query: X,
          hash: ae,
          type: 7
        };
      }
      function C(N) {
        if (h(N)) {
          const R = y("http:" + N);
          return R.scheme = "", R.type = 6, R;
        }
        if (m(N)) {
          const R = y("http://foo.com" + N);
          return R.scheme = "", R.host = "", R.type = 5, R;
        }
        if (g(N))
          return T(N);
        if (c(N))
          return y(N);
        const O = y("http://foo.com/" + N);
        return O.scheme = "", O.host = "", O.type = N ? N.startsWith("?") ? 3 : N.startsWith("#") ? 2 : 4 : 1, O;
      }
      function U(N) {
        if (N.endsWith("/.."))
          return N;
        const O = N.lastIndexOf("/");
        return N.slice(0, O + 1);
      }
      function V(N, O) {
        re(O, O.type), N.path === "/" ? N.path = O.path : N.path = U(O.path) + N.path;
      }
      function re(N, O) {
        const R = O <= 4, Y = N.path.split("/");
        let te = 1, X = 0, ae = !1;
        for (let he = 1; he < Y.length; he++) {
          const pe = Y[he];
          if (!pe) {
            ae = !0;
            continue;
          }
          if (ae = !1, pe !== ".") {
            if (pe === "..") {
              X ? (ae = !0, X--, te--) : R && (Y[te++] = pe);
              continue;
            }
            Y[te++] = pe, X++;
          }
        }
        let de = "";
        for (let he = 1; he < te; he++)
          de += "/" + Y[he];
        (!de || ae && !de.endsWith("/..")) && (de += "/"), N.path = de;
      }
      function ie(N, O) {
        if (!N && !O)
          return "";
        const R = C(N);
        let Y = R.type;
        if (O && Y !== 7) {
          const X = C(O), ae = X.type;
          switch (Y) {
            case 1:
              R.hash = X.hash;
            // fall through
            case 2:
              R.query = X.query;
            // fall through
            case 3:
            case 4:
              V(R, X);
            // fall through
            case 5:
              R.user = X.user, R.host = X.host, R.port = X.port;
            // fall through
            case 6:
              R.scheme = X.scheme;
          }
          ae > Y && (Y = ae);
        }
        re(R, Y);
        const te = R.query + R.hash;
        switch (Y) {
          // This is impossible, because of the empty checks at the start of the function.
          // case UrlType.Empty:
          case 2:
          case 3:
            return te;
          case 4: {
            const X = R.path.slice(1);
            return X ? f(O || N) && !f(X) ? "./" + X + te : X + te : te || ".";
          }
          case 5:
            return R.path + te;
          default:
            return R.scheme + "//" + R.user + R.host + R.port + R.path + te;
        }
      }
      return ie;
    }));
  })(Dt)), Dt.exports;
}
Po();
var Qn = class {
  constructor() {
    this._indexes = { __proto__: null }, this.array = [];
  }
};
function Ro(e, n) {
  return e._indexes[n];
}
function Lo(e, n) {
  const s = Ro(e, n);
  if (s !== void 0) return s;
  const { array: o, _indexes: i } = e, c = o.push(n);
  return i[n] = c - 1;
}
var Do = 0, Oo = 1, Fo = 2, jo = 3, qo = 4, j1 = -1, Mo = class {
  constructor({ file: e, sourceRoot: n } = {}) {
    this._names = new Qn(), this._sources = new Qn(), this._sourcesContent = [], this._mappings = [], this.file = e, this.sourceRoot = n, this._ignoreList = new Qn();
  }
};
var Yn = (e, n, s, o, i, c, h, m) => $o(
  !0,
  e,
  n,
  s,
  o,
  i,
  c
);
function Bo(e) {
  const {
    _mappings: n,
    _sources: s,
    _sourcesContent: o,
    _names: i,
    _ignoreList: c
    // _originalScopes: originalScopes,
    // _generatedRanges: generatedRanges,
  } = e;
  return Wo(n), {
    version: 3,
    file: e.file || void 0,
    names: i.array,
    sourceRoot: e.sourceRoot || void 0,
    sources: s.array,
    sourcesContent: o,
    mappings: n,
    // originalScopes,
    // generatedRanges,
    ignoreList: c.array
  };
}
function Uo(e) {
  const n = Bo(e);
  return Object.assign({}, n, {
    // originalScopes: decoded.originalScopes.map((os) => encodeOriginalScopes(os)),
    // generatedRanges: encodeGeneratedRanges(decoded.generatedRanges as GeneratedRange[]),
    mappings: No(n.mappings)
  });
}
function $o(e, n, s, o, i, c, h, m, g) {
  const {
    _mappings: f,
    _sources: y,
    _sourcesContent: T,
    _names: S
    // _originalScopes: originalScopes,
  } = n, C = Ho(f, s), U = Vo(C, o);
  if (!i)
    return Xo(C, U) ? void 0 : Js(C, U, [o]);
  const V = Lo(y, i), re = j1;
  if (V === T.length && (T[V] = null), !Go(C, U, V, c, h, re))
    return Js(
      C,
      U,
      [o, V, c, h]
    );
}
function Ho(e, n) {
  for (let s = e.length; s <= n; s++)
    e[s] = [];
  return e[n];
}
function Vo(e, n) {
  let s = e.length;
  for (let o = s - 1; o >= 0; s = o--) {
    const i = e[o];
    if (n >= i[Do]) break;
  }
  return s;
}
function Js(e, n, s) {
  for (let o = e.length; o > n; o--)
    e[o] = e[o - 1];
  e[n] = s;
}
function Wo(e) {
  const { length: n } = e;
  let s = n;
  for (let o = s - 1; o >= 0 && !(e[o].length > 0); s = o, o--)
    ;
  s < n && (e.length = s);
}
function Xo(e, n) {
  return n === 0 ? !0 : e[n - 1].length === 1;
}
function Go(e, n, s, o, i, c) {
  if (n === 0) return !1;
  const h = e[n - 1];
  return h.length === 1 ? !1 : s === h[Oo] && o === h[Fo] && i === h[jo] && c === (h.length === 5 ? h[qo] : j1);
}
function zo({ code: e, mappings: n }, s, o, i, c) {
  const h = Jo(i, c), m = new Mo({ file: o.compiledFilename });
  let g = 0, f = n[0];
  for (; f === void 0 && g < n.length - 1; )
    g++, f = n[g];
  let y = 0, T = 0;
  f !== T && Yn(m, y, 0, s, y, 0);
  for (let V = 0; V < e.length; V++) {
    if (V === f) {
      const re = f - T, ie = h[g];
      for (Yn(m, y, re, s, y, ie); (f === V || f === void 0) && g < n.length - 1; )
        g++, f = n[g];
    }
    e.charCodeAt(V) === u.lineFeed && (y++, T = V + 1, f !== T && Yn(m, y, 0, s, y, 0));
  }
  const { sourceRoot: S, sourcesContent: C, ...U } = Uo(m);
  return U;
}
function Jo(e, n) {
  const s = new Array(n.length);
  let o = 0, i = n[o].start, c = 0;
  for (let h = 0; h < e.length; h++)
    h === i && (s[o] = i - c, o++, i = n[o].start), e.charCodeAt(h) === u.lineFeed && (c = h + 1);
  return s;
}
const Qo = {
  require: `
    import {createRequire as CREATE_REQUIRE_NAME} from "module";
    const require = CREATE_REQUIRE_NAME(import.meta.url);
  `,
  interopRequireWildcard: `
    function interopRequireWildcard(obj) {
      if (obj && obj.__esModule) {
        return obj;
      } else {
        var newObj = {};
        if (obj != null) {
          for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              newObj[key] = obj[key];
            }
          }
        }
        newObj.default = obj;
        return newObj;
      }
    }
  `,
  interopRequireDefault: `
    function interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
    }
  `,
  createNamedExportFrom: `
    function createNamedExportFrom(obj, localName, importedName) {
      Object.defineProperty(exports, localName, {enumerable: true, configurable: true, get: () => obj[importedName]});
    }
  `,
  // Note that TypeScript and Babel do this differently; TypeScript does a simple existence
  // check in the exports object and does a plain assignment, whereas Babel uses
  // defineProperty and builds an object of explicitly-exported names so that star exports can
  // always take lower precedence. For now, we do the easier TypeScript thing.
  createStarExport: `
    function createStarExport(obj) {
      Object.keys(obj)
        .filter((key) => key !== "default" && key !== "__esModule")
        .forEach((key) => {
          if (exports.hasOwnProperty(key)) {
            return;
          }
          Object.defineProperty(exports, key, {enumerable: true, configurable: true, get: () => obj[key]});
        });
    }
  `,
  nullishCoalesce: `
    function nullishCoalesce(lhs, rhsFn) {
      if (lhs != null) {
        return lhs;
      } else {
        return rhsFn();
      }
    }
  `,
  asyncNullishCoalesce: `
    async function asyncNullishCoalesce(lhs, rhsFn) {
      if (lhs != null) {
        return lhs;
      } else {
        return await rhsFn();
      }
    }
  `,
  optionalChain: `
    function optionalChain(ops) {
      let lastAccessLHS = undefined;
      let value = ops[0];
      let i = 1;
      while (i < ops.length) {
        const op = ops[i];
        const fn = ops[i + 1];
        i += 2;
        if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) {
          return undefined;
        }
        if (op === 'access' || op === 'optionalAccess') {
          lastAccessLHS = value;
          value = fn(value);
        } else if (op === 'call' || op === 'optionalCall') {
          value = fn((...args) => value.call(lastAccessLHS, ...args));
          lastAccessLHS = undefined;
        }
      }
      return value;
    }
  `,
  asyncOptionalChain: `
    async function asyncOptionalChain(ops) {
      let lastAccessLHS = undefined;
      let value = ops[0];
      let i = 1;
      while (i < ops.length) {
        const op = ops[i];
        const fn = ops[i + 1];
        i += 2;
        if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) {
          return undefined;
        }
        if (op === 'access' || op === 'optionalAccess') {
          lastAccessLHS = value;
          value = await fn(value);
        } else if (op === 'call' || op === 'optionalCall') {
          value = await fn((...args) => value.call(lastAccessLHS, ...args));
          lastAccessLHS = undefined;
        }
      }
      return value;
    }
  `,
  optionalChainDelete: `
    function optionalChainDelete(ops) {
      const result = OPTIONAL_CHAIN_NAME(ops);
      return result == null ? true : result;
    }
  `,
  asyncOptionalChainDelete: `
    async function asyncOptionalChainDelete(ops) {
      const result = await ASYNC_OPTIONAL_CHAIN_NAME(ops);
      return result == null ? true : result;
    }
  `
};
class Mt {
  __init() {
    this.helperNames = {};
  }
  __init2() {
    this.createRequireName = null;
  }
  constructor(n) {
    this.nameManager = n, Mt.prototype.__init.call(this), Mt.prototype.__init2.call(this);
  }
  getHelperName(n) {
    let s = this.helperNames[n];
    return s || (s = this.nameManager.claimFreeName(`_${n}`), this.helperNames[n] = s, s);
  }
  emitHelpers() {
    let n = "";
    this.helperNames.optionalChainDelete && this.getHelperName("optionalChain"), this.helperNames.asyncOptionalChainDelete && this.getHelperName("asyncOptionalChain");
    for (const [s, o] of Object.entries(Qo)) {
      const i = this.helperNames[s];
      let c = o;
      s === "optionalChainDelete" ? c = c.replace("OPTIONAL_CHAIN_NAME", this.helperNames.optionalChain) : s === "asyncOptionalChainDelete" ? c = c.replace(
        "ASYNC_OPTIONAL_CHAIN_NAME",
        this.helperNames.asyncOptionalChain
      ) : s === "require" && (this.createRequireName === null && (this.createRequireName = this.nameManager.claimFreeName("_createRequire")), c = c.replace(/CREATE_REQUIRE_NAME/g, this.createRequireName)), i && (n += " ", n += c.replace(s, i).replace(/\s+/g, " ").trim());
    }
    return n;
  }
}
function Qs(e, n, s) {
  Yo(e, s) && Zo(e, n, s);
}
function Yo(e, n) {
  for (const s of e.tokens)
    if (s.type === t.name && !s.isType && Yr(s) && n.has(e.identifierNameForToken(s)))
      return !0;
  return !1;
}
function Zo(e, n, s) {
  const o = [];
  let i = n.length - 1;
  for (let c = e.tokens.length - 1; ; c--) {
    for (; o.length > 0 && o[o.length - 1].startTokenIndex === c + 1; )
      o.pop();
    for (; i >= 0 && n[i].endTokenIndex === c + 1; )
      o.push(n[i]), i--;
    if (c < 0)
      break;
    const h = e.tokens[c], m = e.identifierNameForToken(h);
    if (o.length > 1 && !h.isType && h.type === t.name && s.has(m)) {
      if (Zr(h))
        Ys(o[o.length - 1], e, m);
      else if (Kr(h)) {
        let g = o.length - 1;
        for (; g > 0 && !o[g].isFunctionScope; )
          g--;
        if (g < 0)
          throw new Error("Did not find parent function scope.");
        Ys(o[g], e, m);
      }
    }
  }
  if (o.length > 0)
    throw new Error("Expected empty scope stack after processing file.");
}
function Ys(e, n, s) {
  for (let o = e.startTokenIndex; o < e.endTokenIndex; o++) {
    const i = n.tokens[o];
    (i.type === t.name || i.type === t.jsxName) && n.identifierNameForToken(i) === s && (i.shadowsGlobal = !0);
  }
}
function Ko(e, n) {
  const s = [];
  for (const o of n)
    o.type === t.name && s.push(e.slice(o.start, o.end));
  return s;
}
class ds {
  __init() {
    this.usedNames = /* @__PURE__ */ new Set();
  }
  constructor(n, s) {
    ds.prototype.__init.call(this), this.usedNames = new Set(Ko(n, s));
  }
  claimFreeName(n) {
    const s = this.findFreeName(n);
    return this.usedNames.add(s), s;
  }
  findFreeName(n) {
    if (!this.usedNames.has(n))
      return n;
    let s = 2;
    for (; this.usedNames.has(n + String(s)); )
      s++;
    return n + String(s);
  }
}
var mt = {}, dt = {}, we = {}, Zs;
function ns() {
  if (Zs) return we;
  Zs = 1;
  var e = we && we.__extends || /* @__PURE__ */ (function() {
    var c = function(h, m) {
      return c = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(g, f) {
        g.__proto__ = f;
      } || function(g, f) {
        for (var y in f) f.hasOwnProperty(y) && (g[y] = f[y]);
      }, c(h, m);
    };
    return function(h, m) {
      c(h, m);
      function g() {
        this.constructor = h;
      }
      h.prototype = m === null ? Object.create(m) : (g.prototype = m.prototype, new g());
    };
  })();
  Object.defineProperty(we, "__esModule", { value: !0 }), we.DetailContext = we.NoopContext = we.VError = void 0;
  var n = (
    /** @class */
    (function(c) {
      e(h, c);
      function h(m, g) {
        var f = c.call(this, g) || this;
        return f.path = m, Object.setPrototypeOf(f, h.prototype), f;
      }
      return h;
    })(Error)
  );
  we.VError = n;
  var s = (
    /** @class */
    (function() {
      function c() {
      }
      return c.prototype.fail = function(h, m, g) {
        return !1;
      }, c.prototype.unionResolver = function() {
        return this;
      }, c.prototype.createContext = function() {
        return this;
      }, c.prototype.resolveUnion = function(h) {
      }, c;
    })()
  );
  we.NoopContext = s;
  var o = (
    /** @class */
    (function() {
      function c() {
        this._propNames = [""], this._messages = [null], this._score = 0;
      }
      return c.prototype.fail = function(h, m, g) {
        return this._propNames.push(h), this._messages.push(m), this._score += g, !1;
      }, c.prototype.unionResolver = function() {
        return new i();
      }, c.prototype.resolveUnion = function(h) {
        for (var m, g, f = h, y = null, T = 0, S = f.contexts; T < S.length; T++) {
          var C = S[T];
          (!y || C._score >= y._score) && (y = C);
        }
        y && y._score > 0 && ((m = this._propNames).push.apply(m, y._propNames), (g = this._messages).push.apply(g, y._messages));
      }, c.prototype.getError = function(h) {
        for (var m = [], g = this._propNames.length - 1; g >= 0; g--) {
          var f = this._propNames[g];
          h += typeof f == "number" ? "[" + f + "]" : f ? "." + f : "";
          var y = this._messages[g];
          y && m.push(h + " " + y);
        }
        return new n(h, m.join("; "));
      }, c.prototype.getErrorDetail = function(h) {
        for (var m = [], g = this._propNames.length - 1; g >= 0; g--) {
          var f = this._propNames[g];
          h += typeof f == "number" ? "[" + f + "]" : f ? "." + f : "";
          var y = this._messages[g];
          y && m.push({ path: h, message: y });
        }
        for (var T = null, g = m.length - 1; g >= 0; g--)
          T && (m[g].nested = [T]), T = m[g];
        return T;
      }, c;
    })()
  );
  we.DetailContext = o;
  var i = (
    /** @class */
    (function() {
      function c() {
        this.contexts = [];
      }
      return c.prototype.createContext = function() {
        var h = new o();
        return this.contexts.push(h), h;
      }, c;
    })()
  );
  return we;
}
var Ks;
function e1() {
  return Ks || (Ks = 1, (function(e) {
    var n = dt && dt.__extends || /* @__PURE__ */ (function() {
      var _ = function(x, I) {
        return _ = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(w, A) {
          w.__proto__ = A;
        } || function(w, A) {
          for (var L in A) A.hasOwnProperty(L) && (w[L] = A[L]);
        }, _(x, I);
      };
      return function(x, I) {
        _(x, I);
        function w() {
          this.constructor = x;
        }
        x.prototype = I === null ? Object.create(I) : (w.prototype = I.prototype, new w());
      };
    })();
    Object.defineProperty(e, "__esModule", { value: !0 }), e.basicTypes = e.BasicType = e.TParamList = e.TParam = e.param = e.TFunc = e.func = e.TProp = e.TOptional = e.opt = e.TIface = e.iface = e.TEnumLiteral = e.enumlit = e.TEnumType = e.enumtype = e.TIntersection = e.intersection = e.TUnion = e.union = e.TTuple = e.tuple = e.TArray = e.array = e.TLiteral = e.lit = e.TName = e.name = e.TType = void 0;
    var s = ns(), o = (
      /** @class */
      /* @__PURE__ */ (function() {
        function _() {
        }
        return _;
      })()
    );
    e.TType = o;
    function i(_) {
      return typeof _ == "string" ? h(_) : _;
    }
    function c(_, x) {
      var I = _[x];
      if (!I)
        throw new Error("Unknown type " + x);
      return I;
    }
    function h(_) {
      return new m(_);
    }
    e.name = h;
    var m = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I) {
          var w = _.call(this) || this;
          return w.name = I, w._failMsg = "is not a " + I, w;
        }
        return x.prototype.getChecker = function(I, w, A) {
          var L = this, D = c(I, this.name), $ = D.getChecker(I, w, A);
          return D instanceof ee || D instanceof x ? $ : function(Q, z) {
            return $(Q, z) ? !0 : z.fail(null, L._failMsg, 0);
          };
        }, x;
      })(o)
    );
    e.TName = m;
    function g(_) {
      return new f(_);
    }
    e.lit = g;
    var f = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I) {
          var w = _.call(this) || this;
          return w.value = I, w.name = JSON.stringify(I), w._failMsg = "is not " + w.name, w;
        }
        return x.prototype.getChecker = function(I, w) {
          var A = this;
          return function(L, D) {
            return L === A.value ? !0 : D.fail(null, A._failMsg, -1);
          };
        }, x;
      })(o)
    );
    e.TLiteral = f;
    function y(_) {
      return new T(i(_));
    }
    e.array = y;
    var T = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I) {
          var w = _.call(this) || this;
          return w.ttype = I, w;
        }
        return x.prototype.getChecker = function(I, w) {
          var A = this.ttype.getChecker(I, w);
          return function(L, D) {
            if (!Array.isArray(L))
              return D.fail(null, "is not an array", 0);
            for (var $ = 0; $ < L.length; $++) {
              var Q = A(L[$], D);
              if (!Q)
                return D.fail($, null, 1);
            }
            return !0;
          };
        }, x;
      })(o)
    );
    e.TArray = T;
    function S() {
      for (var _ = [], x = 0; x < arguments.length; x++)
        _[x] = arguments[x];
      return new C(_.map(function(I) {
        return i(I);
      }));
    }
    e.tuple = S;
    var C = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I) {
          var w = _.call(this) || this;
          return w.ttypes = I, w;
        }
        return x.prototype.getChecker = function(I, w) {
          var A = this.ttypes.map(function(D) {
            return D.getChecker(I, w);
          }), L = function(D, $) {
            if (!Array.isArray(D))
              return $.fail(null, "is not an array", 0);
            for (var Q = 0; Q < A.length; Q++) {
              var z = A[Q](D[Q], $);
              if (!z)
                return $.fail(Q, null, 1);
            }
            return !0;
          };
          return w ? function(D, $) {
            return L(D, $) ? D.length <= A.length ? !0 : $.fail(A.length, "is extraneous", 2) : !1;
          } : L;
        }, x;
      })(o)
    );
    e.TTuple = C;
    function U() {
      for (var _ = [], x = 0; x < arguments.length; x++)
        _[x] = arguments[x];
      return new V(_.map(function(I) {
        return i(I);
      }));
    }
    e.union = U;
    var V = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I) {
          var w = _.call(this) || this;
          w.ttypes = I;
          var A = I.map(function(D) {
            return D instanceof m || D instanceof f ? D.name : null;
          }).filter(function(D) {
            return D;
          }), L = I.length - A.length;
          return A.length ? (L > 0 && A.push(L + " more"), w._failMsg = "is none of " + A.join(", ")) : w._failMsg = "is none of " + L + " types", w;
        }
        return x.prototype.getChecker = function(I, w) {
          var A = this, L = this.ttypes.map(function(D) {
            return D.getChecker(I, w);
          });
          return function(D, $) {
            for (var Q = $.unionResolver(), z = 0; z < L.length; z++) {
              var ce = L[z](D, Q.createContext());
              if (ce)
                return !0;
            }
            return $.resolveUnion(Q), $.fail(null, A._failMsg, 0);
          };
        }, x;
      })(o)
    );
    e.TUnion = V;
    function re() {
      for (var _ = [], x = 0; x < arguments.length; x++)
        _[x] = arguments[x];
      return new ie(_.map(function(I) {
        return i(I);
      }));
    }
    e.intersection = re;
    var ie = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I) {
          var w = _.call(this) || this;
          return w.ttypes = I, w;
        }
        return x.prototype.getChecker = function(I, w) {
          var A = /* @__PURE__ */ new Set(), L = this.ttypes.map(function(D) {
            return D.getChecker(I, w, A);
          });
          return function(D, $) {
            var Q = L.every(function(z) {
              return z(D, $);
            });
            return Q ? !0 : $.fail(null, null, 0);
          };
        }, x;
      })(o)
    );
    e.TIntersection = ie;
    function N(_) {
      return new O(_);
    }
    e.enumtype = N;
    var O = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I) {
          var w = _.call(this) || this;
          return w.members = I, w.validValues = /* @__PURE__ */ new Set(), w._failMsg = "is not a valid enum value", w.validValues = new Set(Object.keys(I).map(function(A) {
            return I[A];
          })), w;
        }
        return x.prototype.getChecker = function(I, w) {
          var A = this;
          return function(L, D) {
            return A.validValues.has(L) ? !0 : D.fail(null, A._failMsg, 0);
          };
        }, x;
      })(o)
    );
    e.TEnumType = O;
    function R(_, x) {
      return new Y(_, x);
    }
    e.enumlit = R;
    var Y = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I, w) {
          var A = _.call(this) || this;
          return A.enumName = I, A.prop = w, A._failMsg = "is not " + I + "." + w, A;
        }
        return x.prototype.getChecker = function(I, w) {
          var A = this, L = c(I, this.enumName);
          if (!(L instanceof O))
            throw new Error("Type " + this.enumName + " used in enumlit is not an enum type");
          var D = L.members[this.prop];
          if (!L.members.hasOwnProperty(this.prop))
            throw new Error("Unknown value " + this.enumName + "." + this.prop + " used in enumlit");
          return function($, Q) {
            return $ === D ? !0 : Q.fail(null, A._failMsg, -1);
          };
        }, x;
      })(o)
    );
    e.TEnumLiteral = Y;
    function te(_) {
      return Object.keys(_).map(function(x) {
        return X(x, _[x]);
      });
    }
    function X(_, x) {
      return x instanceof pe ? new ve(_, x.ttype, !0) : new ve(_, i(x), !1);
    }
    function ae(_, x) {
      return new de(_, te(x));
    }
    e.iface = ae;
    var de = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I, w) {
          var A = _.call(this) || this;
          return A.bases = I, A.props = w, A.propSet = new Set(w.map(function(L) {
            return L.name;
          })), A;
        }
        return x.prototype.getChecker = function(I, w, A) {
          var L = this, D = this.bases.map(function(ne) {
            return c(I, ne).getChecker(I, w);
          }), $ = this.props.map(function(ne) {
            return ne.ttype.getChecker(I, w);
          }), Q = new s.NoopContext(), z = this.props.map(function(ne, fe) {
            return !ne.isOpt && !$[fe](void 0, Q);
          }), ce = function(ne, fe) {
            if (typeof ne != "object" || ne === null)
              return fe.fail(null, "is not an object", 0);
            for (var me = 0; me < D.length; me++)
              if (!D[me](ne, fe))
                return !1;
            for (var me = 0; me < $.length; me++) {
              var Qe = L.props[me].name, ot = ne[Qe];
              if (ot === void 0) {
                if (z[me])
                  return fe.fail(Qe, "is missing", 1);
              } else {
                var pt = $[me](ot, fe);
                if (!pt)
                  return fe.fail(Qe, null, 1);
              }
            }
            return !0;
          };
          if (!w)
            return ce;
          var _e = this.propSet;
          return A && (this.propSet.forEach(function(ne) {
            return A.add(ne);
          }), _e = A), function(ne, fe) {
            if (!ce(ne, fe))
              return !1;
            for (var me in ne)
              if (!_e.has(me))
                return fe.fail(me, "is extraneous", 2);
            return !0;
          };
        }, x;
      })(o)
    );
    e.TIface = de;
    function he(_) {
      return new pe(i(_));
    }
    e.opt = he;
    var pe = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I) {
          var w = _.call(this) || this;
          return w.ttype = I, w;
        }
        return x.prototype.getChecker = function(I, w) {
          var A = this.ttype.getChecker(I, w);
          return function(L, D) {
            return L === void 0 || A(L, D);
          };
        }, x;
      })(o)
    );
    e.TOptional = pe;
    var ve = (
      /** @class */
      /* @__PURE__ */ (function() {
        function _(x, I, w) {
          this.name = x, this.ttype = I, this.isOpt = w;
        }
        return _;
      })()
    );
    e.TProp = ve;
    function Be(_) {
      for (var x = [], I = 1; I < arguments.length; I++)
        x[I - 1] = arguments[I];
      return new De(new Fe(x), i(_));
    }
    e.func = Be;
    var De = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I, w) {
          var A = _.call(this) || this;
          return A.paramList = I, A.result = w, A;
        }
        return x.prototype.getChecker = function(I, w) {
          return function(A, L) {
            return typeof A == "function" ? !0 : L.fail(null, "is not a function", 0);
          };
        }, x;
      })(o)
    );
    e.TFunc = De;
    function Ue(_, x, I) {
      return new Oe(_, i(x), !!I);
    }
    e.param = Ue;
    var Oe = (
      /** @class */
      /* @__PURE__ */ (function() {
        function _(x, I, w) {
          this.name = x, this.ttype = I, this.isOpt = w;
        }
        return _;
      })()
    );
    e.TParam = Oe;
    var Fe = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I) {
          var w = _.call(this) || this;
          return w.params = I, w;
        }
        return x.prototype.getChecker = function(I, w) {
          var A = this, L = this.params.map(function(z) {
            return z.ttype.getChecker(I, w);
          }), D = new s.NoopContext(), $ = this.params.map(function(z, ce) {
            return !z.isOpt && !L[ce](void 0, D);
          }), Q = function(z, ce) {
            if (!Array.isArray(z))
              return ce.fail(null, "is not an array", 0);
            for (var _e = 0; _e < L.length; _e++) {
              var ne = A.params[_e];
              if (z[_e] === void 0) {
                if ($[_e])
                  return ce.fail(ne.name, "is missing", 1);
              } else {
                var fe = L[_e](z[_e], ce);
                if (!fe)
                  return ce.fail(ne.name, null, 1);
              }
            }
            return !0;
          };
          return w ? function(z, ce) {
            return Q(z, ce) ? z.length <= L.length ? !0 : ce.fail(L.length, "is extraneous", 2) : !1;
          } : Q;
        }, x;
      })(o)
    );
    e.TParamList = Fe;
    var ee = (
      /** @class */
      (function(_) {
        n(x, _);
        function x(I, w) {
          var A = _.call(this) || this;
          return A.validator = I, A.message = w, A;
        }
        return x.prototype.getChecker = function(I, w) {
          var A = this;
          return function(L, D) {
            return A.validator(L) ? !0 : D.fail(null, A.message, 0);
          };
        }, x;
      })(o)
    );
    e.BasicType = ee, e.basicTypes = {
      any: new ee(function(_) {
        return !0;
      }, "is invalid"),
      number: new ee(function(_) {
        return typeof _ == "number";
      }, "is not a number"),
      object: new ee(function(_) {
        return typeof _ == "object" && _;
      }, "is not an object"),
      boolean: new ee(function(_) {
        return typeof _ == "boolean";
      }, "is not a boolean"),
      string: new ee(function(_) {
        return typeof _ == "string";
      }, "is not a string"),
      symbol: new ee(function(_) {
        return typeof _ == "symbol";
      }, "is not a symbol"),
      void: new ee(function(_) {
        return _ == null;
      }, "is not void"),
      undefined: new ee(function(_) {
        return _ === void 0;
      }, "is not undefined"),
      null: new ee(function(_) {
        return _ === null;
      }, "is not null"),
      never: new ee(function(_) {
        return !1;
      }, "is unexpected"),
      Date: new ee(je("[object Date]"), "is not a Date"),
      RegExp: new ee(je("[object RegExp]"), "is not a RegExp")
    };
    var $e = Object.prototype.toString;
    function je(_) {
      return function(x) {
        return typeof x == "object" && x && $e.call(x) === _;
      };
    }
    typeof Buffer < "u" && (e.basicTypes.Buffer = new ee(function(_) {
      return Buffer.isBuffer(_);
    }, "is not a Buffer"));
    for (var He = function(_) {
      e.basicTypes[_.name] = new ee(function(x) {
        return x instanceof _;
      }, "is not a " + _.name);
    }, Ne = 0, qe = [
      Int8Array,
      Uint8Array,
      Uint8ClampedArray,
      Int16Array,
      Uint16Array,
      Int32Array,
      Uint32Array,
      Float32Array,
      Float64Array,
      ArrayBuffer
    ]; Ne < qe.length; Ne++) {
      var Ve = qe[Ne];
      He(Ve);
    }
  })(dt)), dt;
}
var t1;
function ei() {
  return t1 || (t1 = 1, (function(e) {
    var n = mt && mt.__spreadArrays || function() {
      for (var g = 0, f = 0, y = arguments.length; f < y; f++) g += arguments[f].length;
      for (var T = Array(g), S = 0, f = 0; f < y; f++)
        for (var C = arguments[f], U = 0, V = C.length; U < V; U++, S++)
          T[S] = C[U];
      return T;
    };
    Object.defineProperty(e, "__esModule", { value: !0 }), e.Checker = e.createCheckers = void 0;
    var s = e1(), o = ns(), i = e1();
    Object.defineProperty(e, "TArray", { enumerable: !0, get: function() {
      return i.TArray;
    } }), Object.defineProperty(e, "TEnumType", { enumerable: !0, get: function() {
      return i.TEnumType;
    } }), Object.defineProperty(e, "TEnumLiteral", { enumerable: !0, get: function() {
      return i.TEnumLiteral;
    } }), Object.defineProperty(e, "TFunc", { enumerable: !0, get: function() {
      return i.TFunc;
    } }), Object.defineProperty(e, "TIface", { enumerable: !0, get: function() {
      return i.TIface;
    } }), Object.defineProperty(e, "TLiteral", { enumerable: !0, get: function() {
      return i.TLiteral;
    } }), Object.defineProperty(e, "TName", { enumerable: !0, get: function() {
      return i.TName;
    } }), Object.defineProperty(e, "TOptional", { enumerable: !0, get: function() {
      return i.TOptional;
    } }), Object.defineProperty(e, "TParam", { enumerable: !0, get: function() {
      return i.TParam;
    } }), Object.defineProperty(e, "TParamList", { enumerable: !0, get: function() {
      return i.TParamList;
    } }), Object.defineProperty(e, "TProp", { enumerable: !0, get: function() {
      return i.TProp;
    } }), Object.defineProperty(e, "TTuple", { enumerable: !0, get: function() {
      return i.TTuple;
    } }), Object.defineProperty(e, "TType", { enumerable: !0, get: function() {
      return i.TType;
    } }), Object.defineProperty(e, "TUnion", { enumerable: !0, get: function() {
      return i.TUnion;
    } }), Object.defineProperty(e, "TIntersection", { enumerable: !0, get: function() {
      return i.TIntersection;
    } }), Object.defineProperty(e, "array", { enumerable: !0, get: function() {
      return i.array;
    } }), Object.defineProperty(e, "enumlit", { enumerable: !0, get: function() {
      return i.enumlit;
    } }), Object.defineProperty(e, "enumtype", { enumerable: !0, get: function() {
      return i.enumtype;
    } }), Object.defineProperty(e, "func", { enumerable: !0, get: function() {
      return i.func;
    } }), Object.defineProperty(e, "iface", { enumerable: !0, get: function() {
      return i.iface;
    } }), Object.defineProperty(e, "lit", { enumerable: !0, get: function() {
      return i.lit;
    } }), Object.defineProperty(e, "name", { enumerable: !0, get: function() {
      return i.name;
    } }), Object.defineProperty(e, "opt", { enumerable: !0, get: function() {
      return i.opt;
    } }), Object.defineProperty(e, "param", { enumerable: !0, get: function() {
      return i.param;
    } }), Object.defineProperty(e, "tuple", { enumerable: !0, get: function() {
      return i.tuple;
    } }), Object.defineProperty(e, "union", { enumerable: !0, get: function() {
      return i.union;
    } }), Object.defineProperty(e, "intersection", { enumerable: !0, get: function() {
      return i.intersection;
    } }), Object.defineProperty(e, "BasicType", { enumerable: !0, get: function() {
      return i.BasicType;
    } });
    var c = ns();
    Object.defineProperty(e, "VError", { enumerable: !0, get: function() {
      return c.VError;
    } });
    function h() {
      for (var g = [], f = 0; f < arguments.length; f++)
        g[f] = arguments[f];
      for (var y = Object.assign.apply(Object, n([{}, s.basicTypes], g)), T = {}, S = 0, C = g; S < C.length; S++)
        for (var U = C[S], V = 0, re = Object.keys(U); V < re.length; V++) {
          var ie = re[V];
          T[ie] = new m(y, U[ie]);
        }
      return T;
    }
    e.createCheckers = h;
    var m = (
      /** @class */
      (function() {
        function g(f, y, T) {
          if (T === void 0 && (T = "value"), this.suite = f, this.ttype = y, this._path = T, this.props = /* @__PURE__ */ new Map(), y instanceof s.TIface)
            for (var S = 0, C = y.props; S < C.length; S++) {
              var U = C[S];
              this.props.set(U.name, U.ttype);
            }
          this.checkerPlain = this.ttype.getChecker(f, !1), this.checkerStrict = this.ttype.getChecker(f, !0);
        }
        return g.prototype.setReportedPath = function(f) {
          this._path = f;
        }, g.prototype.check = function(f) {
          return this._doCheck(this.checkerPlain, f);
        }, g.prototype.test = function(f) {
          return this.checkerPlain(f, new o.NoopContext());
        }, g.prototype.validate = function(f) {
          return this._doValidate(this.checkerPlain, f);
        }, g.prototype.strictCheck = function(f) {
          return this._doCheck(this.checkerStrict, f);
        }, g.prototype.strictTest = function(f) {
          return this.checkerStrict(f, new o.NoopContext());
        }, g.prototype.strictValidate = function(f) {
          return this._doValidate(this.checkerStrict, f);
        }, g.prototype.getProp = function(f) {
          var y = this.props.get(f);
          if (!y)
            throw new Error("Type has no property " + f);
          return new g(this.suite, y, this._path + "." + f);
        }, g.prototype.methodArgs = function(f) {
          var y = this._getMethod(f);
          return new g(this.suite, y.paramList);
        }, g.prototype.methodResult = function(f) {
          var y = this._getMethod(f);
          return new g(this.suite, y.result);
        }, g.prototype.getArgs = function() {
          if (!(this.ttype instanceof s.TFunc))
            throw new Error("getArgs() applied to non-function");
          return new g(this.suite, this.ttype.paramList);
        }, g.prototype.getResult = function() {
          if (!(this.ttype instanceof s.TFunc))
            throw new Error("getResult() applied to non-function");
          return new g(this.suite, this.ttype.result);
        }, g.prototype.getType = function() {
          return this.ttype;
        }, g.prototype._doCheck = function(f, y) {
          var T = new o.NoopContext();
          if (!f(y, T)) {
            var S = new o.DetailContext();
            throw f(y, S), S.getError(this._path);
          }
        }, g.prototype._doValidate = function(f, y) {
          var T = new o.NoopContext();
          if (f(y, T))
            return null;
          var S = new o.DetailContext();
          return f(y, S), S.getErrorDetail(this._path);
        }, g.prototype._getMethod = function(f) {
          var y = this.props.get(f);
          if (!y)
            throw new Error("Type has no property " + f);
          if (!(y instanceof s.TFunc))
            throw new Error("Property " + f + " is not a method");
          return y;
        }, g;
      })()
    );
    e.Checker = m;
  })(mt)), mt;
}
var G = ei();
const ti = G.union(
  G.lit("jsx"),
  G.lit("typescript"),
  G.lit("flow"),
  G.lit("imports"),
  G.lit("react-hot-loader"),
  G.lit("jest")
), ni = G.iface([], {
  compiledFilename: "string"
}), si = G.iface([], {
  transforms: G.array("Transform"),
  disableESTransforms: G.opt("boolean"),
  jsxRuntime: G.opt(G.union(G.lit("classic"), G.lit("automatic"), G.lit("preserve"))),
  production: G.opt("boolean"),
  jsxImportSource: G.opt("string"),
  jsxPragma: G.opt("string"),
  jsxFragmentPragma: G.opt("string"),
  keepUnusedImports: G.opt("boolean"),
  preserveDynamicImport: G.opt("boolean"),
  injectCreateRequireForImportRequire: G.opt("boolean"),
  enableLegacyTypeScriptModuleInterop: G.opt("boolean"),
  enableLegacyBabel5ModuleInterop: G.opt("boolean"),
  sourceMapOptions: G.opt("SourceMapOptions"),
  filePath: G.opt("string")
}), ri = {
  Transform: ti,
  SourceMapOptions: ni,
  Options: si
}, { Options: oi } = G.createCheckers(ri);
function ii(e) {
  oi.strictCheck(e);
}
function q1() {
  k(), ue(!1);
}
function M1(e) {
  k(), Qt(e);
}
function Je(e) {
  P(), ks(e);
}
function Bt() {
  P(), r.tokens[r.tokens.length - 1].identifierRole = v.ImportDeclaration;
}
function ks(e) {
  let n;
  r.scopeDepth === 0 ? n = v.TopLevelDeclaration : e ? n = v.BlockScopedDeclaration : n = v.FunctionScopedDeclaration, r.tokens[r.tokens.length - 1].identifierRole = n;
}
function Qt(e) {
  switch (r.type) {
    case t._this: {
      const n = M(0);
      k(), q(n);
      return;
    }
    case t._yield:
    case t.name: {
      r.type = t.name, Je(e);
      return;
    }
    case t.bracketL: {
      k(), gs(
        t.bracketR,
        e,
        !0
        /* allowEmpty */
      );
      return;
    }
    case t.braceL:
      vs(!0, e);
      return;
    default:
      j();
  }
}
function gs(e, n, s = !1, o = !1, i = 0) {
  let c = !0, h = !1;
  const m = r.tokens.length;
  for (; !p(e) && !r.error; )
    if (c ? c = !1 : (d(t.comma), r.tokens[r.tokens.length - 1].contextId = i, !h && r.tokens[m].isType && (r.tokens[r.tokens.length - 1].isType = !0, h = !0)), !(s && a(t.comma))) {
      if (p(e))
        break;
      if (a(t.ellipsis)) {
        M1(n), B1(), p(t.comma), d(e);
        break;
      } else
        ai(o, n);
    }
}
function ai(e, n) {
  e && _s([
    l._public,
    l._protected,
    l._private,
    l._readonly,
    l._override
  ]), Ut(n), B1(), Ut(
    n,
    !0
    /* leftAlreadyParsed */
  );
}
function B1() {
  H ? Ac() : B && da();
}
function Ut(e, n = !1) {
  if (n || Qt(e), !p(t.eq))
    return;
  const s = r.tokens.length - 1;
  ue(), r.tokens[s].rhsEndIndex = r.tokens.length;
}
function ss() {
  return a(t.name);
}
function ci() {
  return a(t.name) || !!(r.type & t.IS_KEYWORD) || a(t.string) || a(t.num) || a(t.bigint) || a(t.decimal);
}
function U1() {
  const e = r.snapshot();
  return k(), (a(t.bracketL) || a(t.braceL) || a(t.star) || a(t.ellipsis) || a(t.hash) || ci()) && !ge() ? !0 : (r.restoreFromSnapshot(e), !1);
}
function _s(e) {
  for (; $1(e) !== null; )
    ;
}
function $1(e) {
  if (!a(t.name))
    return null;
  const n = r.contextualKeyword;
  if (e.indexOf(n) !== -1 && U1()) {
    switch (n) {
      case l._readonly:
        r.tokens[r.tokens.length - 1].type = t._readonly;
        break;
      case l._abstract:
        r.tokens[r.tokens.length - 1].type = t._abstract;
        break;
      case l._static:
        r.tokens[r.tokens.length - 1].type = t._static;
        break;
      case l._public:
        r.tokens[r.tokens.length - 1].type = t._public;
        break;
      case l._private:
        r.tokens[r.tokens.length - 1].type = t._private;
        break;
      case l._protected:
        r.tokens[r.tokens.length - 1].type = t._protected;
        break;
      case l._override:
        r.tokens[r.tokens.length - 1].type = t._override;
        break;
      case l._declare:
        r.tokens[r.tokens.length - 1].type = t._declare;
        break;
    }
    return n;
  }
  return null;
}
function vt() {
  for (P(); p(t.dot); )
    P();
}
function li() {
  vt(), !ge() && a(t.lessThan) && ut();
}
function ui() {
  k(), Nt();
}
function hi() {
  k();
}
function pi() {
  d(t._typeof), a(t._import) ? H1() : vt(), !ge() && a(t.lessThan) && ut();
}
function H1() {
  d(t._import), d(t.parenL), d(t.string), d(t.parenR), p(t.dot) && vt(), a(t.lessThan) && ut();
}
function fi() {
  p(t._const);
  const e = p(t._in), n = oe(l._out);
  p(t._const), (e || n) && !a(t.name) ? r.tokens[r.tokens.length - 1].type = t.name : P(), p(t._extends) && K(), p(t.eq) && K();
}
function st() {
  a(t.lessThan) && Yt();
}
function Yt() {
  const e = M(0);
  for (a(t.lessThan) || a(t.typeParameterStart) ? k() : j(); !p(t.greaterThan) && !r.error; )
    fi(), p(t.comma);
  q(e);
}
function xs(e) {
  const n = e === t.arrow;
  st(), d(t.parenL), r.scopeDepth++, mi(
    !1
    /* isBlockScope */
  ), r.scopeDepth--, (n || a(e)) && bt(e);
}
function mi(e) {
  gs(t.parenR, e);
}
function $t() {
  p(t.comma) || J();
}
function n1() {
  xs(t.colon), $t();
}
function di() {
  const e = r.snapshot();
  k();
  const n = p(t.name) && a(t.colon);
  return r.restoreFromSnapshot(e), n;
}
function V1() {
  if (!(a(t.bracketL) && di()))
    return !1;
  const e = M(0);
  return d(t.bracketL), P(), Nt(), d(t.bracketR), lt(), $t(), q(e), !0;
}
function s1(e) {
  p(t.question), !e && (a(t.parenL) || a(t.lessThan)) ? (xs(t.colon), $t()) : (lt(), $t());
}
function ki() {
  if (a(t.parenL) || a(t.lessThan)) {
    n1();
    return;
  }
  if (a(t._new)) {
    k(), a(t.parenL) || a(t.lessThan) ? n1() : s1(!1);
    return;
  }
  const e = !!$1([l._readonly]);
  V1() || ((E(l._get) || E(l._set)) && U1(), wt(
    -1
    /* Types don't need context IDs. */
  ), s1(e));
}
function gi() {
  W1();
}
function W1() {
  for (d(t.braceL); !p(t.braceR) && !r.error; )
    ki();
}
function _i() {
  const e = r.snapshot(), n = xi();
  return r.restoreFromSnapshot(e), n;
}
function xi() {
  return k(), p(t.plus) || p(t.minus) ? E(l._readonly) : (E(l._readonly) && k(), !a(t.bracketL) || (k(), !ss()) ? !1 : (k(), a(t._in)));
}
function yi() {
  P(), d(t._in), K();
}
function Ii() {
  d(t.braceL), a(t.plus) || a(t.minus) ? (k(), se(l._readonly)) : oe(l._readonly), d(t.bracketL), yi(), oe(l._as) && K(), d(t.bracketR), a(t.plus) || a(t.minus) ? (k(), d(t.question)) : p(t.question), Oi(), J(), d(t.braceR);
}
function bi() {
  for (d(t.bracketL); !p(t.bracketR) && !r.error; )
    wi(), p(t.comma);
}
function wi() {
  p(t.ellipsis) ? K() : (K(), p(t.question)), p(t.colon) && K();
}
function Ti() {
  d(t.parenL), K(), d(t.parenR);
}
function Ai() {
  for (We(), We(); !a(t.backQuote) && !r.error; )
    d(t.dollarBraceL), K(), We(), We();
  k();
}
var Xe;
(function(e) {
  e[e.TSFunctionType = 0] = "TSFunctionType";
  const s = 1;
  e[e.TSConstructorType = s] = "TSConstructorType";
  const o = s + 1;
  e[e.TSAbstractConstructorType = o] = "TSAbstractConstructorType";
})(Xe || (Xe = {}));
function Zn(e) {
  e === Xe.TSAbstractConstructorType && se(l._abstract), (e === Xe.TSConstructorType || e === Xe.TSAbstractConstructorType) && d(t._new);
  const n = r.inDisallowConditionalTypesContext;
  r.inDisallowConditionalTypesContext = !1, xs(t.arrow), r.inDisallowConditionalTypesContext = n;
}
function Ei() {
  switch (r.type) {
    case t.name:
      li();
      return;
    case t._void:
    case t._null:
      k();
      return;
    case t.string:
    case t.num:
    case t.bigint:
    case t.decimal:
    case t._true:
    case t._false:
      ct();
      return;
    case t.minus:
      k(), ct();
      return;
    case t._this: {
      hi(), E(l._is) && !ge() && ui();
      return;
    }
    case t._typeof:
      pi();
      return;
    case t._import:
      H1();
      return;
    case t.braceL:
      _i() ? Ii() : gi();
      return;
    case t.bracketL:
      bi();
      return;
    case t.parenL:
      Ti();
      return;
    case t.backQuote:
      Ai();
      return;
    default:
      if (r.type & t.IS_KEYWORD) {
        k(), r.tokens[r.tokens.length - 1].type = t.name;
        return;
      }
      break;
  }
  j();
}
function Si() {
  for (Ei(); !ge() && p(t.bracketL); )
    p(t.bracketR) || (K(), d(t.bracketR));
}
function vi() {
  if (se(l._infer), P(), a(t._extends)) {
    const e = r.snapshot();
    d(t._extends);
    const n = r.inDisallowConditionalTypesContext;
    r.inDisallowConditionalTypesContext = !0, K(), r.inDisallowConditionalTypesContext = n, (r.error || !r.inDisallowConditionalTypesContext && a(t.question)) && r.restoreFromSnapshot(e);
  }
}
function rs() {
  if (E(l._keyof) || E(l._unique) || E(l._readonly))
    k(), rs();
  else if (E(l._infer))
    vi();
  else {
    const e = r.inDisallowConditionalTypesContext;
    r.inDisallowConditionalTypesContext = !1, Si(), r.inDisallowConditionalTypesContext = e;
  }
}
function r1() {
  if (p(t.bitwiseAND), rs(), a(t.bitwiseAND))
    for (; p(t.bitwiseAND); )
      rs();
}
function Ni() {
  if (p(t.bitwiseOR), r1(), a(t.bitwiseOR))
    for (; p(t.bitwiseOR); )
      r1();
}
function Ci() {
  return a(t.lessThan) ? !0 : a(t.parenL) && Ri();
}
function Pi() {
  if (a(t.name) || a(t._this))
    return k(), !0;
  if (a(t.braceL) || a(t.bracketL)) {
    let e = 1;
    for (k(); e > 0 && !r.error; )
      a(t.braceL) || a(t.bracketL) ? e++ : (a(t.braceR) || a(t.bracketR)) && e--, k();
    return !0;
  }
  return !1;
}
function Ri() {
  const e = r.snapshot(), n = Li();
  return r.restoreFromSnapshot(e), n;
}
function Li() {
  return k(), !!(a(t.parenR) || a(t.ellipsis) || Pi() && (a(t.colon) || a(t.comma) || a(t.question) || a(t.eq) || a(t.parenR) && (k(), a(t.arrow))));
}
function bt(e) {
  const n = M(0);
  d(e), Fi() || K(), q(n);
}
function Di() {
  a(t.colon) && bt(t.colon);
}
function lt() {
  a(t.colon) && Nt();
}
function Oi() {
  p(t.colon) && K();
}
function Fi() {
  const e = r.snapshot();
  return E(l._asserts) ? (k(), oe(l._is) ? (K(), !0) : ss() || a(t._this) ? (k(), oe(l._is) && K(), !0) : (r.restoreFromSnapshot(e), !1)) : ss() || a(t._this) ? (k(), E(l._is) && !ge() ? (k(), K(), !0) : (r.restoreFromSnapshot(e), !1)) : !1;
}
function Nt() {
  const e = M(0);
  d(t.colon), K(), q(e);
}
function K() {
  if (o1(), r.inDisallowConditionalTypesContext || ge() || !p(t._extends))
    return;
  const e = r.inDisallowConditionalTypesContext;
  r.inDisallowConditionalTypesContext = !0, o1(), r.inDisallowConditionalTypesContext = e, d(t.question), K(), d(t.colon), K();
}
function ji() {
  return E(l._abstract) && Z() === t._new;
}
function o1() {
  if (Ci()) {
    Zn(Xe.TSFunctionType);
    return;
  }
  if (a(t._new)) {
    Zn(Xe.TSConstructorType);
    return;
  } else if (ji()) {
    Zn(Xe.TSAbstractConstructorType);
    return;
  }
  Ni();
}
function qi() {
  const e = M(1);
  K(), d(t.greaterThan), q(e), Ct();
}
function Mi() {
  if (p(t.jsxTagStart)) {
    r.tokens[r.tokens.length - 1].type = t.typeParameterStart;
    const e = M(1);
    for (; !a(t.greaterThan) && !r.error; )
      K(), p(t.comma);
    be(), q(e);
  }
}
function X1() {
  for (; !a(t.braceL) && !r.error; )
    Bi(), p(t.comma);
}
function Bi() {
  vt(), a(t.lessThan) && ut();
}
function Ui() {
  Je(!1), st(), p(t._extends) && X1(), W1();
}
function $i() {
  Je(!1), st(), d(t.eq), K(), J();
}
function Hi() {
  if (a(t.string) ? ct() : P(), p(t.eq)) {
    const e = r.tokens.length - 1;
    ue(), r.tokens[e].rhsEndIndex = r.tokens.length;
  }
}
function ys() {
  for (Je(!1), d(t.braceL); !p(t.braceR) && !r.error; )
    Hi(), p(t.comma);
}
function Is() {
  d(t.braceL), tn(
    /* end */
    t.braceR
  );
}
function os() {
  Je(!1), p(t.dot) ? os() : Is();
}
function G1() {
  E(l._global) ? P() : a(t.string) ? Me() : j(), a(t.braceL) ? Is() : J();
}
function is() {
  Bt(), d(t.eq), Wi(), J();
}
function Vi() {
  return E(l._require) && Z() === t.parenL;
}
function Wi() {
  Vi() ? Xi() : vt();
}
function Xi() {
  se(l._require), d(t.parenL), a(t.string) || j(), ct(), d(t.parenR);
}
function Gi() {
  if (Ce())
    return !1;
  switch (r.type) {
    case t._function: {
      const e = M(1);
      k();
      const n = r.start;
      return tt(
        n,
        /* isStatement */
        !0
      ), q(e), !0;
    }
    case t._class: {
      const e = M(1);
      return nt(
        /* isStatement */
        !0,
        /* optionalId */
        !1
      ), q(e), !0;
    }
    case t._const:
      if (a(t._const) && fs(l._enum)) {
        const e = M(1);
        return d(t._const), se(l._enum), r.tokens[r.tokens.length - 1].type = t._enum, ys(), q(e), !0;
      }
    // falls through
    case t._var:
    case t._let: {
      const e = M(1);
      return jt(r.type !== t._var), q(e), !0;
    }
    case t.name: {
      const e = M(1), n = r.contextualKeyword;
      let s = !1;
      return n === l._global ? (G1(), s = !0) : s = Zt(
        n,
        /* isBeforeToken */
        !0
      ), q(e), s;
    }
    default:
      return !1;
  }
}
function i1() {
  return Zt(
    r.contextualKeyword,
    /* isBeforeToken */
    !0
  );
}
function zi(e) {
  switch (e) {
    case l._declare: {
      const n = r.tokens.length - 1;
      if (Gi())
        return r.tokens[n].type = t._declare, !0;
      break;
    }
    case l._global:
      if (a(t.braceL))
        return Is(), !0;
      break;
    default:
      return Zt(
        e,
        /* isBeforeToken */
        !1
      );
  }
  return !1;
}
function Zt(e, n) {
  switch (e) {
    case l._abstract:
      if (it(n) && a(t._class))
        return r.tokens[r.tokens.length - 1].type = t._abstract, nt(
          /* isStatement */
          !0,
          /* optionalId */
          !1
        ), !0;
      break;
    case l._enum:
      if (it(n) && a(t.name))
        return r.tokens[r.tokens.length - 1].type = t._enum, ys(), !0;
      break;
    case l._interface:
      if (it(n) && a(t.name)) {
        const s = M(n ? 2 : 1);
        return Ui(), q(s), !0;
      }
      break;
    case l._module:
      if (it(n)) {
        if (a(t.string)) {
          const s = M(n ? 2 : 1);
          return G1(), q(s), !0;
        } else if (a(t.name)) {
          const s = M(n ? 2 : 1);
          return os(), q(s), !0;
        }
      }
      break;
    case l._namespace:
      if (it(n) && a(t.name)) {
        const s = M(n ? 2 : 1);
        return os(), q(s), !0;
      }
      break;
    case l._type:
      if (it(n) && a(t.name)) {
        const s = M(n ? 2 : 1);
        return $i(), q(s), !0;
      }
      break;
  }
  return !1;
}
function it(e) {
  return e ? (k(), !0) : !Ce();
}
function Ji() {
  const e = r.snapshot();
  return Yt(), ht(), Di(), d(t.arrow), r.error ? (r.restoreFromSnapshot(e), !1) : (Pt(!0), !0);
}
function bs() {
  r.type === t.bitShiftL && (r.pos -= 1, F(t.lessThan)), ut();
}
function ut() {
  const e = M(0);
  for (d(t.lessThan); !a(t.greaterThan) && !r.error; )
    K(), p(t.comma);
  e ? (d(t.greaterThan), q(e)) : (q(e), N1(), d(t.greaterThan), r.tokens[r.tokens.length - 1].isType = !0);
}
function z1() {
  if (a(t.name))
    switch (r.contextualKeyword) {
      case l._abstract:
      case l._declare:
      case l._enum:
      case l._interface:
      case l._module:
      case l._namespace:
      case l._type:
        return !0;
    }
  return !1;
}
function Qi(e, n) {
  if (a(t.colon) && bt(t.colon), !a(t.braceL) && Ce()) {
    let s = r.tokens.length - 1;
    for (; s >= 0 && (r.tokens[s].start >= e || r.tokens[s].type === t._default || r.tokens[s].type === t._export); )
      r.tokens[s].isType = !0, s--;
    return;
  }
  Pt(!1, n);
}
function Yi(e, n, s) {
  if (!ge() && p(t.bang)) {
    r.tokens[r.tokens.length - 1].type = t.nonNullAssertion;
    return;
  }
  if (a(t.lessThan) || a(t.bitShiftL)) {
    const o = r.snapshot();
    if (!n && nr() && Ji())
      return;
    if (bs(), !n && p(t.parenL) ? (r.tokens[r.tokens.length - 1].subscriptStartIndex = e, Ge()) : a(t.backQuote) ? Ss() : (
      // The remaining possible case is an instantiation expression, e.g.
      // Array<number> . Check for a few cases that would disqualify it and
      // cause us to bail out.
      // a<b>>c is not (a<b>)>c, but a<(b>>c)
      (r.type === t.greaterThan || // a<b>c is (a<b)>c
      r.type !== t.parenL && r.type & t.IS_EXPRESSION_START && !ge()) && j()
    ), r.error)
      r.restoreFromSnapshot(o);
    else
      return;
  } else !n && a(t.questionDot) && Z() === t.lessThan && (k(), r.tokens[e].isOptionalChainStart = !0, r.tokens[r.tokens.length - 1].subscriptStartIndex = e, ut(), d(t.parenL), Ge());
  Ts(e, n, s);
}
function Zi() {
  if (p(t._import))
    return E(l._type) && Z() !== t.eq && se(l._type), is(), !0;
  if (p(t.eq))
    return le(), J(), !0;
  if (oe(l._as))
    return se(l._namespace), P(), J(), !0;
  if (E(l._type)) {
    const e = Z();
    (e === t.braceL || e === t.star) && k();
  }
  return !1;
}
function Ki() {
  if (P(), a(t.comma) || a(t.braceR)) {
    r.tokens[r.tokens.length - 1].identifierRole = v.ImportDeclaration;
    return;
  }
  if (P(), a(t.comma) || a(t.braceR)) {
    r.tokens[r.tokens.length - 1].identifierRole = v.ImportDeclaration, r.tokens[r.tokens.length - 2].isType = !0, r.tokens[r.tokens.length - 1].isType = !0;
    return;
  }
  if (P(), a(t.comma) || a(t.braceR)) {
    r.tokens[r.tokens.length - 3].identifierRole = v.ImportAccess, r.tokens[r.tokens.length - 1].identifierRole = v.ImportDeclaration;
    return;
  }
  P(), r.tokens[r.tokens.length - 3].identifierRole = v.ImportAccess, r.tokens[r.tokens.length - 1].identifierRole = v.ImportDeclaration, r.tokens[r.tokens.length - 4].isType = !0, r.tokens[r.tokens.length - 3].isType = !0, r.tokens[r.tokens.length - 2].isType = !0, r.tokens[r.tokens.length - 1].isType = !0;
}
function ea() {
  if (P(), a(t.comma) || a(t.braceR)) {
    r.tokens[r.tokens.length - 1].identifierRole = v.ExportAccess;
    return;
  }
  if (P(), a(t.comma) || a(t.braceR)) {
    r.tokens[r.tokens.length - 1].identifierRole = v.ExportAccess, r.tokens[r.tokens.length - 2].isType = !0, r.tokens[r.tokens.length - 1].isType = !0;
    return;
  }
  if (P(), a(t.comma) || a(t.braceR)) {
    r.tokens[r.tokens.length - 3].identifierRole = v.ExportAccess;
    return;
  }
  P(), r.tokens[r.tokens.length - 3].identifierRole = v.ExportAccess, r.tokens[r.tokens.length - 4].isType = !0, r.tokens[r.tokens.length - 3].isType = !0, r.tokens[r.tokens.length - 2].isType = !0, r.tokens[r.tokens.length - 1].isType = !0;
}
function ta() {
  if (E(l._abstract) && Z() === t._class)
    return r.type = t._abstract, k(), nt(!0, !0), !0;
  if (E(l._interface)) {
    const e = M(2);
    return Zt(l._interface, !0), q(e), !0;
  }
  return !1;
}
function na() {
  if (r.type === t._const) {
    const e = St();
    if (e.type === t.name && e.contextualKeyword === l._enum)
      return d(t._const), se(l._enum), r.tokens[r.tokens.length - 1].type = t._enum, ys(), !0;
  }
  return !1;
}
function sa(e) {
  const n = r.tokens.length;
  _s([
    l._abstract,
    l._readonly,
    l._declare,
    l._static,
    l._override
  ]);
  const s = r.tokens.length;
  if (V1()) {
    const i = e ? n - 1 : n;
    for (let c = i; c < s; c++)
      r.tokens[c].isType = !0;
    return !0;
  }
  return !1;
}
function ra(e) {
  zi(e) || J();
}
function oa() {
  const e = oe(l._declare);
  e && (r.tokens[r.tokens.length - 1].type = t._declare);
  let n = !1;
  if (a(t.name))
    if (e) {
      const s = M(2);
      n = i1(), q(s);
    } else
      n = i1();
  if (!n)
    if (e) {
      const s = M(2);
      Ie(!0), q(s);
    } else
      Ie(!0);
}
function ia(e) {
  if (e && (a(t.lessThan) || a(t.bitShiftL)) && bs(), oe(l._implements)) {
    r.tokens[r.tokens.length - 1].type = t._implements;
    const n = M(1);
    X1(), q(n);
  }
}
function aa() {
  st();
}
function ca() {
  st();
}
function la() {
  const e = M(0);
  ge() || p(t.bang), lt(), q(e);
}
function ua() {
  a(t.colon) && Nt();
}
function ha(e, n) {
  return zt ? pa(e, n) : fa(e, n);
}
function pa(e, n) {
  if (!a(t.lessThan))
    return Pe(e, n);
  const s = r.snapshot();
  let o = Pe(e, n);
  if (r.error)
    r.restoreFromSnapshot(s);
  else
    return o;
  return r.type = t.typeParameterStart, Yt(), o = Pe(e, n), o || j(), o;
}
function fa(e, n) {
  if (!a(t.lessThan))
    return Pe(e, n);
  const s = r.snapshot();
  Yt();
  const o = Pe(e, n);
  if (o || j(), r.error)
    r.restoreFromSnapshot(s);
  else
    return o;
  return Pe(e, n);
}
function ma() {
  if (a(t.colon)) {
    const e = r.snapshot();
    bt(t.colon), ye() && j(), a(t.arrow) || j(), r.error && r.restoreFromSnapshot(e);
  }
  return p(t.arrow);
}
function da() {
  const e = M(0);
  p(t.question), lt(), q(e);
}
function ka() {
  (a(t.lessThan) || a(t.bitShiftL)) && bs(), mr();
}
function ga() {
  let e = !1, n = !1;
  for (; ; ) {
    if (r.pos >= b.length) {
      j("Unterminated JSX contents");
      return;
    }
    const s = b.charCodeAt(r.pos);
    if (s === u.lessThan || s === u.leftCurlyBrace) {
      if (r.pos === r.start) {
        if (s === u.lessThan) {
          r.pos++, F(t.jsxTagStart);
          return;
        }
        C1(s);
        return;
      }
      F(e && !n ? t.jsxEmptyText : t.jsxText);
      return;
    }
    s === u.lineFeed ? e = !0 : s !== u.space && s !== u.carriageReturn && s !== u.tab && (n = !0), r.pos++;
  }
}
function _a(e) {
  for (r.pos++; ; ) {
    if (r.pos >= b.length) {
      j("Unterminated string constant");
      return;
    }
    if (b.charCodeAt(r.pos) === e) {
      r.pos++;
      break;
    }
    r.pos++;
  }
  F(t.string);
}
function xa() {
  let e;
  do {
    if (r.pos > b.length) {
      j("Unexpectedly reached the end of input.");
      return;
    }
    e = b.charCodeAt(++r.pos);
  } while (Ae[e] || e === u.dash);
  F(t.jsxName);
}
function as() {
  be();
}
function J1(e) {
  if (as(), !p(t.colon)) {
    r.tokens[r.tokens.length - 1].identifierRole = e;
    return;
  }
  as();
}
function Q1() {
  const e = r.tokens.length;
  J1(v.Access);
  let n = !1;
  for (; a(t.dot); )
    n = !0, be(), as();
  if (!n) {
    const s = r.tokens[e], o = b.charCodeAt(s.start);
    o >= u.lowercaseA && o <= u.lowercaseZ && (s.identifierRole = null);
  }
}
function ya() {
  switch (r.type) {
    case t.braceL:
      k(), le(), be();
      return;
    case t.jsxTagStart:
      Z1(), be();
      return;
    case t.string:
      be();
      return;
    default:
      j("JSX value should be either an expression or a quoted JSX text");
  }
}
function Ia() {
  d(t.ellipsis), le();
}
function ba(e) {
  if (a(t.jsxTagEnd))
    return !1;
  Q1(), B && Mi();
  let n = !1;
  for (; !a(t.slash) && !a(t.jsxTagEnd) && !r.error; ) {
    if (p(t.braceL)) {
      n = !0, d(t.ellipsis), ue(), be();
      continue;
    }
    n && r.end - r.start === 3 && b.charCodeAt(r.start) === u.lowercaseK && b.charCodeAt(r.start + 1) === u.lowercaseE && b.charCodeAt(r.start + 2) === u.lowercaseY && (r.tokens[e].jsxRole = Te.KeyAfterPropSpread), J1(v.ObjectKey), a(t.eq) && (be(), ya());
  }
  const s = a(t.slash);
  return s && be(), s;
}
function wa() {
  a(t.jsxTagEnd) || Q1();
}
function Y1() {
  const e = r.tokens.length - 1;
  r.tokens[e].jsxRole = Te.NoChildren;
  let n = 0;
  if (!ba(e))
    for (at(); ; )
      switch (r.type) {
        case t.jsxTagStart:
          if (be(), a(t.slash)) {
            be(), wa(), r.tokens[e].jsxRole !== Te.KeyAfterPropSpread && (n === 1 ? r.tokens[e].jsxRole = Te.OneChild : n > 1 && (r.tokens[e].jsxRole = Te.StaticChildren));
            return;
          }
          n++, Y1(), at();
          break;
        case t.jsxText:
          n++, at();
          break;
        case t.jsxEmptyText:
          at();
          break;
        case t.braceL:
          k(), a(t.ellipsis) ? (Ia(), at(), n += 2) : (a(t.braceR) || (n++, le()), at());
          break;
        // istanbul ignore next - should never happen
        default:
          j();
          return;
      }
}
function Z1() {
  be(), Y1();
}
function be() {
  r.tokens.push(new Jt()), S1(), r.start = r.pos;
  const e = b.charCodeAt(r.pos);
  if (Et[e])
    xa();
  else if (e === u.quotationMark || e === u.apostrophe)
    _a(e);
  else
    switch (++r.pos, e) {
      case u.greaterThan:
        F(t.jsxTagEnd);
        break;
      case u.lessThan:
        F(t.jsxTagStart);
        break;
      case u.slash:
        F(t.slash);
        break;
      case u.equalsTo:
        F(t.eq);
        break;
      case u.leftCurlyBrace:
        F(t.braceL);
        break;
      case u.dot:
        F(t.dot);
        break;
      case u.colon:
        F(t.colon);
        break;
      default:
        j();
    }
}
function at() {
  r.tokens.push(new Jt()), r.start = r.pos, ga();
}
function Ta(e) {
  if (a(t.question)) {
    const n = Z();
    if (n === t.colon || n === t.comma || n === t.parenR)
      return;
  }
  K1(e);
}
function Aa() {
  b1(t.question), a(t.colon) && (B ? Nt() : H && rt());
}
class Ea {
  constructor(n) {
    this.stop = n;
  }
}
function le(e = !1) {
  if (ue(e), a(t.comma))
    for (; p(t.comma); )
      ue(e);
}
function ue(e = !1, n = !1) {
  return B ? ha(e, n) : H ? Pc(e, n) : Pe(e, n);
}
function Pe(e, n) {
  if (a(t._yield))
    return $a(), !1;
  (a(t.parenL) || a(t.name) || a(t._yield)) && (r.potentialArrowAt = r.start);
  const s = Sa(e);
  return n && Es(), r.type & t.IS_ASSIGN ? (k(), ue(e), !1) : s;
}
function Sa(e) {
  return Na(e) ? !0 : (va(e), !1);
}
function va(e) {
  B || H ? Ta(e) : K1(e);
}
function K1(e) {
  p(t.question) && (ue(), d(t.colon), ue(e));
}
function Na(e) {
  const n = r.tokens.length;
  return Ct() ? !0 : (Ot(n, -1, e), !1);
}
function Ot(e, n, s) {
  if (B && (t._in & t.PRECEDENCE_MASK) > n && !ge() && (oe(l._as) || oe(l._satisfies))) {
    const i = M(1);
    K(), q(i), N1(), Ot(e, n, s);
    return;
  }
  const o = r.type & t.PRECEDENCE_MASK;
  if (o > 0 && (!s || !a(t._in)) && o > n) {
    const i = r.type;
    k(), i === t.nullishCoalescing && (r.tokens[r.tokens.length - 1].nullishStartIndex = e);
    const c = r.tokens.length;
    Ct(), Ot(c, i & t.IS_RIGHT_ASSOCIATIVE ? o - 1 : o, s), i === t.nullishCoalescing && (r.tokens[e].numNullishCoalesceStarts++, r.tokens[r.tokens.length - 1].numNullishCoalesceEnds++), Ot(e, n, s);
  }
}
function Ct() {
  if (B && !zt && p(t.lessThan))
    return qi(), !1;
  if (E(l._module) && T1() === u.leftCurlyBrace && !g1())
    return Ha(), !1;
  if (r.type & t.IS_PREFIX)
    return k(), Ct(), !1;
  if (er())
    return !0;
  for (; r.type & t.IS_POSTFIX && !ye(); )
    r.type === t.preIncDec && (r.type = t.postIncDec), k();
  return !1;
}
function er() {
  const e = r.tokens.length;
  return Me() ? !0 : (ws(e), r.tokens.length > e && r.tokens[e].isOptionalChainStart && (r.tokens[r.tokens.length - 1].isOptionalChainEnd = !0), !1);
}
function ws(e, n = !1) {
  H ? Lc(e, n) : tr(e, n);
}
function tr(e, n = !1) {
  const s = new Ea(!1);
  do
    Ca(e, n, s);
  while (!s.stop && !r.error);
}
function Ca(e, n, s) {
  B ? Yi(e, n, s) : H ? fc(e, n, s) : Ts(e, n, s);
}
function Ts(e, n, s) {
  if (!n && p(t.doubleColon))
    As(), s.stop = !0, ws(e, n);
  else if (a(t.questionDot)) {
    if (r.tokens[e].isOptionalChainStart = !0, n && Z() === t.parenL) {
      s.stop = !0;
      return;
    }
    k(), r.tokens[r.tokens.length - 1].subscriptStartIndex = e, p(t.bracketL) ? (le(), d(t.bracketR)) : p(t.parenL) ? Ge() : Ht();
  } else if (p(t.dot))
    r.tokens[r.tokens.length - 1].subscriptStartIndex = e, Ht();
  else if (p(t.bracketL))
    r.tokens[r.tokens.length - 1].subscriptStartIndex = e, le(), d(t.bracketR);
  else if (!n && a(t.parenL))
    if (nr()) {
      const o = r.snapshot(), i = r.tokens.length;
      k(), r.tokens[r.tokens.length - 1].subscriptStartIndex = e;
      const c = yt();
      r.tokens[r.tokens.length - 1].contextId = c, Ge(), r.tokens[r.tokens.length - 1].contextId = c, Pa() && (r.restoreFromSnapshot(o), s.stop = !0, r.scopeDepth++, ht(), Ra(i));
    } else {
      k(), r.tokens[r.tokens.length - 1].subscriptStartIndex = e;
      const o = yt();
      r.tokens[r.tokens.length - 1].contextId = o, Ge(), r.tokens[r.tokens.length - 1].contextId = o;
    }
  else a(t.backQuote) ? Ss() : s.stop = !0;
}
function nr() {
  return r.tokens[r.tokens.length - 1].contextualKeyword === l._async && !ye();
}
function Ge() {
  let e = !0;
  for (; !p(t.parenR) && !r.error; ) {
    if (e)
      e = !1;
    else if (d(t.comma), p(t.parenR))
      break;
    ir(!1);
  }
}
function Pa() {
  return a(t.colon) || a(t.arrow);
}
function Ra(e) {
  B ? ua() : H && Cc(), d(t.arrow), Tt(e);
}
function As() {
  const e = r.tokens.length;
  Me(), ws(e, !0);
}
function Me() {
  if (p(t.modulo))
    return P(), !1;
  if (a(t.jsxText) || a(t.jsxEmptyText))
    return ct(), !1;
  if (a(t.lessThan) && zt)
    return r.type = t.jsxTagStart, Z1(), k(), !1;
  const e = r.potentialArrowAt === r.start;
  switch (r.type) {
    case t.slash:
    case t.assign:
      to();
    // Fall through.
    case t._super:
    case t._this:
    case t.regexp:
    case t.num:
    case t.bigint:
    case t.decimal:
    case t.string:
    case t._null:
    case t._true:
    case t._false:
      return k(), !1;
    case t._import:
      return k(), a(t.dot) && (r.tokens[r.tokens.length - 1].type = t.name, k(), P()), !1;
    case t.name: {
      const n = r.tokens.length, s = r.start, o = r.contextualKeyword;
      return P(), o === l._await ? (Ua(), !1) : o === l._async && a(t._function) && !ye() ? (k(), tt(s, !1), !1) : e && o === l._async && !ye() && a(t.name) ? (r.scopeDepth++, Je(!1), d(t.arrow), Tt(n), !0) : a(t._do) && !ye() ? (k(), ze(), !1) : e && !ye() && a(t.arrow) ? (r.scopeDepth++, ks(!1), d(t.arrow), Tt(n), !0) : (r.tokens[r.tokens.length - 1].identifierRole = v.Access, !1);
    }
    case t._do:
      return k(), ze(), !1;
    case t.parenL:
      return sr(e);
    case t.bracketL:
      return k(), or(t.bracketR, !0), !1;
    case t.braceL:
      return vs(!1, !1), !1;
    case t._function:
      return La(), !1;
    case t.at:
      js();
    // Fall through.
    case t._class:
      return nt(!1), !1;
    case t._new:
      return Oa(), !1;
    case t.backQuote:
      return Ss(), !1;
    case t.doubleColon:
      return k(), As(), !1;
    case t.hash: {
      const n = T1();
      return Et[n] || n === u.backslash ? Ht() : k(), !1;
    }
    default:
      return j(), !1;
  }
}
function Ht() {
  p(t.hash), P();
}
function La() {
  const e = r.start;
  P(), p(t.dot) && P(), tt(e, !1);
}
function ct() {
  k();
}
function Kt() {
  d(t.parenL), le(), d(t.parenR);
}
function sr(e) {
  const n = r.snapshot(), s = r.tokens.length;
  d(t.parenL);
  let o = !0;
  for (; !a(t.parenR) && !r.error; ) {
    if (o)
      o = !1;
    else if (d(t.comma), a(t.parenR))
      break;
    if (a(t.ellipsis)) {
      M1(
        !1
        /* isBlockScope */
      ), Es();
      break;
    } else
      ue(!1, !0);
  }
  return d(t.parenR), e && Da() && cs() ? (r.restoreFromSnapshot(n), r.scopeDepth++, ht(), cs(), Tt(s), r.error ? (r.restoreFromSnapshot(n), sr(!1), !1) : !0) : !1;
}
function Da() {
  return a(t.colon) || !ye();
}
function cs() {
  return B ? ma() : H ? Rc() : p(t.arrow);
}
function Es() {
  (B || H) && Aa();
}
function Oa() {
  if (d(t._new), p(t.dot)) {
    P();
    return;
  }
  Fa(), H && mc(), p(t.parenL) && or(t.parenR);
}
function Fa() {
  As(), p(t.questionDot);
}
function Ss() {
  for (We(), We(); !a(t.backQuote) && !r.error; )
    d(t.dollarBraceL), le(), We(), We();
  k();
}
function vs(e, n) {
  const s = yt();
  let o = !0;
  for (k(), r.tokens[r.tokens.length - 1].contextId = s; !p(t.braceR) && !r.error; ) {
    if (o)
      o = !1;
    else if (d(t.comma), p(t.braceR))
      break;
    let i = !1;
    if (a(t.ellipsis)) {
      const c = r.tokens.length;
      if (q1(), e && (r.tokens.length === c + 2 && ks(n), p(t.braceR)))
        break;
      continue;
    }
    e || (i = p(t.star)), !e && E(l._async) ? (i && j(), P(), a(t.colon) || a(t.parenL) || a(t.braceR) || a(t.eq) || a(t.comma) || (a(t.star) && (k(), i = !0), wt(s))) : wt(s), Ba(e, n, s);
  }
  r.tokens[r.tokens.length - 1].contextId = s;
}
function ja(e) {
  return !e && (a(t.string) || // get "string"() {}
  a(t.num) || // get 1() {}
  a(t.bracketL) || // get ["string"]() {}
  a(t.name) || // get foo() {}
  !!(r.type & t.IS_KEYWORD));
}
function qa(e, n) {
  const s = r.start;
  return a(t.parenL) ? (e && j(), ls(
    s,
    /* isConstructor */
    !1
  ), !0) : ja(e) ? (wt(n), ls(
    s,
    /* isConstructor */
    !1
  ), !0) : !1;
}
function Ma(e, n) {
  if (p(t.colon)) {
    e ? Ut(n) : ue(!1);
    return;
  }
  let s;
  e ? r.scopeDepth === 0 ? s = v.ObjectShorthandTopLevelDeclaration : n ? s = v.ObjectShorthandBlockScopedDeclaration : s = v.ObjectShorthandFunctionScopedDeclaration : s = v.ObjectShorthand, r.tokens[r.tokens.length - 1].identifierRole = s, Ut(n, !0);
}
function Ba(e, n, s) {
  B ? aa() : H && Tc(), qa(e, s) || Ma(e, n);
}
function wt(e) {
  H && Fs(), p(t.bracketL) ? (r.tokens[r.tokens.length - 1].contextId = e, ue(), d(t.bracketR), r.tokens[r.tokens.length - 1].contextId = e) : (a(t.num) || a(t.string) || a(t.bigint) || a(t.decimal) ? Me() : Ht(), r.tokens[r.tokens.length - 1].identifierRole = v.ObjectKey, r.tokens[r.tokens.length - 1].contextId = e);
}
function ls(e, n) {
  const s = yt();
  r.scopeDepth++;
  const o = r.tokens.length;
  ht(n, s), rr(e, s);
  const c = r.tokens.length;
  r.scopes.push(new Re(o, c, !0)), r.scopeDepth--;
}
function Tt(e) {
  Pt(!0);
  const n = r.tokens.length;
  r.scopes.push(new Re(e, n, !0)), r.scopeDepth--;
}
function rr(e, n = 0) {
  B ? Qi(e, n) : H ? pc(n) : Pt(!1, n);
}
function Pt(e, n = 0) {
  e && !a(t.braceL) ? ue() : ze(!0, n);
}
function or(e, n = !1) {
  let s = !0;
  for (; !p(e) && !r.error; ) {
    if (s)
      s = !1;
    else if (d(t.comma), p(e)) break;
    ir(n);
  }
}
function ir(e) {
  e && a(t.comma) || (a(t.ellipsis) ? (q1(), Es()) : a(t.question) ? k() : ue(!1, !0));
}
function P() {
  k(), r.tokens[r.tokens.length - 1].type = t.name;
}
function Ua() {
  Ct();
}
function $a() {
  k(), !a(t.semi) && !ye() && (p(t.star), ue());
}
function Ha() {
  se(l._module), d(t.braceL), tn(t.braceR);
}
function Va(e) {
  return (e.type === t.name || !!(e.type & t.IS_KEYWORD)) && e.contextualKeyword !== l._from;
}
function Le(e) {
  const n = M(0);
  d(e || t.colon), xe(), q(n);
}
function a1() {
  d(t.modulo), se(l._checks), p(t.parenL) && (le(), d(t.parenR));
}
function Ns() {
  const e = M(0);
  d(t.colon), a(t.modulo) ? a1() : (xe(), a(t.modulo) && a1()), q(e);
}
function Wa() {
  k(), Cs(
    /* isClass */
    !0
  );
}
function Xa() {
  k(), P(), a(t.lessThan) && Se(), d(t.parenL), hs(), d(t.parenR), Ns(), J();
}
function us() {
  a(t._class) ? Wa() : a(t._function) ? Xa() : a(t._var) ? Ga() : oe(l._module) ? p(t.dot) ? Qa() : za() : E(l._type) ? Ya() : E(l._opaque) ? Za() : E(l._interface) ? Ka() : a(t._export) ? Ja() : j();
}
function Ga() {
  k(), ur(), J();
}
function za() {
  for (a(t.string) ? Me() : P(), d(t.braceL); !a(t.braceR) && !r.error; )
    a(t._import) ? (k(), yr()) : j();
  d(t.braceR);
}
function Ja() {
  d(t._export), p(t._default) ? a(t._function) || a(t._class) ? us() : (xe(), J()) : a(t._var) || // declare export var ...
  a(t._function) || // declare export function ...
  a(t._class) || // declare export class ...
  E(l._opaque) ? us() : a(t.star) || // declare export * from ''
  a(t.braceL) || // declare export {} ...
  E(l._interface) || // declare export interface ...
  E(l._type) || // declare export type ...
  E(l._opaque) ? _r() : j();
}
function Qa() {
  se(l._exports), rt(), J();
}
function Ya() {
  k(), Rs();
}
function Za() {
  k(), Ls(!0);
}
function Ka() {
  k(), Cs();
}
function Cs(e = !1) {
  if (en(), a(t.lessThan) && Se(), p(t._extends))
    do
      Ft();
    while (!e && p(t.comma));
  if (E(l._mixins)) {
    k();
    do
      Ft();
    while (p(t.comma));
  }
  if (E(l._implements)) {
    k();
    do
      Ft();
    while (p(t.comma));
  }
  Vt(e, !1, e);
}
function Ft() {
  ar(!1), a(t.lessThan) && et();
}
function Ps() {
  Cs();
}
function en() {
  P();
}
function Rs() {
  en(), a(t.lessThan) && Se(), Le(t.eq), J();
}
function Ls(e) {
  se(l._type), en(), a(t.lessThan) && Se(), a(t.colon) && Le(t.colon), e || Le(t.eq), J();
}
function ec() {
  Fs(), ur(), p(t.eq) && xe();
}
function Se() {
  const e = M(0);
  a(t.lessThan) || a(t.typeParameterStart) ? k() : j();
  do
    ec(), a(t.greaterThan) || d(t.comma);
  while (!a(t.greaterThan) && !r.error);
  d(t.greaterThan), q(e);
}
function et() {
  const e = M(0);
  for (d(t.lessThan); !a(t.greaterThan) && !r.error; )
    xe(), a(t.greaterThan) || d(t.comma);
  d(t.greaterThan), q(e);
}
function tc() {
  if (se(l._interface), p(t._extends))
    do
      Ft();
    while (p(t.comma));
  Vt(!1, !1, !1);
}
function Ds() {
  a(t.num) || a(t.string) ? Me() : P();
}
function nc() {
  Z() === t.colon ? (Ds(), Le()) : xe(), d(t.bracketR), Le();
}
function sc() {
  Ds(), d(t.bracketR), d(t.bracketR), a(t.lessThan) || a(t.parenL) ? Os() : (p(t.question), Le());
}
function Os() {
  for (a(t.lessThan) && Se(), d(t.parenL); !a(t.parenR) && !a(t.ellipsis) && !r.error; )
    Wt(), a(t.parenR) || d(t.comma);
  p(t.ellipsis) && Wt(), d(t.parenR), Le();
}
function rc() {
  Os();
}
function Vt(e, n, s) {
  let o;
  for (n && a(t.braceBarL) ? (d(t.braceBarL), o = t.braceBarR) : (d(t.braceL), o = t.braceR); !a(o) && !r.error; ) {
    if (s && E(l._proto)) {
      const i = Z();
      i !== t.colon && i !== t.question && (k(), e = !1);
    }
    if (e && E(l._static)) {
      const i = Z();
      i !== t.colon && i !== t.question && k();
    }
    if (Fs(), p(t.bracketL))
      p(t.bracketL) ? sc() : nc();
    else if (a(t.parenL) || a(t.lessThan))
      rc();
    else {
      if (E(l._get) || E(l._set)) {
        const i = Z();
        (i === t.name || i === t.string || i === t.num) && k();
      }
      oc();
    }
    ic();
  }
  d(o);
}
function oc() {
  if (a(t.ellipsis)) {
    if (d(t.ellipsis), p(t.comma) || p(t.semi), a(t.braceR))
      return;
    xe();
  } else
    Ds(), a(t.lessThan) || a(t.parenL) ? Os() : (p(t.question), Le());
}
function ic() {
  !p(t.semi) && !p(t.comma) && !a(t.braceR) && !a(t.braceBarR) && j();
}
function ar(e) {
  for (e || P(); p(t.dot); )
    P();
}
function ac() {
  ar(!0), a(t.lessThan) && et();
}
function cc() {
  d(t._typeof), cr();
}
function lc() {
  for (d(t.bracketL); r.pos < b.length && !a(t.bracketR) && (xe(), !a(t.bracketR)); )
    d(t.comma);
  d(t.bracketR);
}
function Wt() {
  const e = Z();
  e === t.colon || e === t.question ? (P(), p(t.question), Le()) : xe();
}
function hs() {
  for (; !a(t.parenR) && !a(t.ellipsis) && !r.error; )
    Wt(), a(t.parenR) || d(t.comma);
  p(t.ellipsis) && Wt();
}
function cr() {
  let e = !1;
  const n = r.noAnonFunctionType;
  switch (r.type) {
    case t.name: {
      if (E(l._interface)) {
        tc();
        return;
      }
      P(), ac();
      return;
    }
    case t.braceL:
      Vt(!1, !1, !1);
      return;
    case t.braceBarL:
      Vt(!1, !0, !1);
      return;
    case t.bracketL:
      lc();
      return;
    case t.lessThan:
      Se(), d(t.parenL), hs(), d(t.parenR), d(t.arrow), xe();
      return;
    case t.parenL:
      if (k(), !a(t.parenR) && !a(t.ellipsis))
        if (a(t.name)) {
          const s = Z();
          e = s !== t.question && s !== t.colon;
        } else
          e = !0;
      if (e)
        if (r.noAnonFunctionType = !1, xe(), r.noAnonFunctionType = n, r.noAnonFunctionType || !(a(t.comma) || a(t.parenR) && Z() === t.arrow)) {
          d(t.parenR);
          return;
        } else
          p(t.comma);
      hs(), d(t.parenR), d(t.arrow), xe();
      return;
    case t.minus:
      k(), ct();
      return;
    case t.string:
    case t.num:
    case t._true:
    case t._false:
    case t._null:
    case t._this:
    case t._void:
    case t.star:
      k();
      return;
    default:
      if (r.type === t._typeof) {
        cc();
        return;
      } else if (r.type & t.IS_KEYWORD) {
        k(), r.tokens[r.tokens.length - 1].type = t.name;
        return;
      }
  }
  j();
}
function uc() {
  for (cr(); !ye() && (a(t.bracketL) || a(t.questionDot)); )
    p(t.questionDot), d(t.bracketL), p(t.bracketR) || (xe(), d(t.bracketR));
}
function lr() {
  p(t.question) ? lr() : uc();
}
function c1() {
  lr(), !r.noAnonFunctionType && p(t.arrow) && xe();
}
function l1() {
  for (p(t.bitwiseAND), c1(); p(t.bitwiseAND); )
    c1();
}
function hc() {
  for (p(t.bitwiseOR), l1(); p(t.bitwiseOR); )
    l1();
}
function xe() {
  hc();
}
function rt() {
  Le();
}
function ur() {
  P(), a(t.colon) && rt();
}
function Fs() {
  (a(t.plus) || a(t.minus)) && (k(), r.tokens[r.tokens.length - 1].isType = !0);
}
function pc(e) {
  a(t.colon) && Ns(), Pt(!1, e);
}
function fc(e, n, s) {
  if (a(t.questionDot) && Z() === t.lessThan) {
    if (n) {
      s.stop = !0;
      return;
    }
    k(), et(), d(t.parenL), Ge();
    return;
  } else if (!n && a(t.lessThan)) {
    const o = r.snapshot();
    if (et(), d(t.parenL), Ge(), r.error)
      r.restoreFromSnapshot(o);
    else
      return;
  }
  Ts(e, n, s);
}
function mc() {
  if (a(t.lessThan)) {
    const e = r.snapshot();
    et(), r.error && r.restoreFromSnapshot(e);
  }
}
function dc() {
  if (a(t.name) && r.contextualKeyword === l._interface) {
    const e = M(0);
    return k(), Ps(), q(e), !0;
  } else if (E(l._enum))
    return hr(), !0;
  return !1;
}
function kc() {
  return E(l._enum) ? (hr(), !0) : !1;
}
function gc(e) {
  if (e === l._declare) {
    if (a(t._class) || a(t.name) || a(t._function) || a(t._var) || a(t._export)) {
      const n = M(1);
      us(), q(n);
    }
  } else if (a(t.name)) {
    if (e === l._interface) {
      const n = M(1);
      Ps(), q(n);
    } else if (e === l._type) {
      const n = M(1);
      Rs(), q(n);
    } else if (e === l._opaque) {
      const n = M(1);
      Ls(!1), q(n);
    }
  }
  J();
}
function _c() {
  return E(l._type) || E(l._interface) || E(l._opaque) || E(l._enum);
}
function xc() {
  return a(t.name) && (r.contextualKeyword === l._type || r.contextualKeyword === l._interface || r.contextualKeyword === l._opaque || r.contextualKeyword === l._enum);
}
function yc() {
  if (E(l._type)) {
    const e = M(1);
    k(), a(t.braceL) ? (qs(), At()) : Rs(), q(e);
  } else if (E(l._opaque)) {
    const e = M(1);
    k(), Ls(!1), q(e);
  } else if (E(l._interface)) {
    const e = M(1);
    k(), Ps(), q(e);
  } else
    Ie(!0);
}
function Ic() {
  return a(t.star) || E(l._type) && Z() === t.star;
}
function bc() {
  if (oe(l._type)) {
    const e = M(2);
    ps(), q(e);
  } else
    ps();
}
function wc(e) {
  if (e && a(t.lessThan) && et(), E(l._implements)) {
    const n = M(0);
    k(), r.tokens[r.tokens.length - 1].type = t._implements;
    do
      en(), a(t.lessThan) && et();
    while (p(t.comma));
    q(n);
  }
}
function Tc() {
  a(t.lessThan) && (Se(), a(t.parenL) || j());
}
function Ac() {
  const e = M(0);
  p(t.question), a(t.colon) && rt(), q(e);
}
function Ec() {
  if (a(t._typeof) || E(l._type)) {
    const e = St();
    (Va(e) || e.type === t.braceL || e.type === t.star) && k();
  }
}
function Sc() {
  const e = r.contextualKeyword === l._type || r.type === t._typeof;
  e ? k() : P(), E(l._as) && !fs(l._as) ? (P(), e && !a(t.name) && !(r.type & t.IS_KEYWORD) || P()) : (e && (a(t.name) || r.type & t.IS_KEYWORD) && P(), oe(l._as) && P());
}
function vc() {
  if (a(t.lessThan)) {
    const e = M(0);
    Se(), q(e);
  }
}
function Nc() {
  a(t.colon) && rt();
}
function Cc() {
  if (a(t.colon)) {
    const e = r.noAnonFunctionType;
    r.noAnonFunctionType = !0, rt(), r.noAnonFunctionType = e;
  }
}
function Pc(e, n) {
  if (a(t.lessThan)) {
    const s = r.snapshot();
    let o = Pe(e, n);
    if (r.error)
      r.restoreFromSnapshot(s), r.type = t.typeParameterStart;
    else
      return o;
    const i = M(0);
    if (Se(), q(i), o = Pe(e, n), o)
      return !0;
    j();
  }
  return Pe(e, n);
}
function Rc() {
  if (a(t.colon)) {
    const e = M(0), n = r.snapshot(), s = r.noAnonFunctionType;
    r.noAnonFunctionType = !0, Ns(), r.noAnonFunctionType = s, ye() && j(), a(t.arrow) || j(), r.error && r.restoreFromSnapshot(n), q(e);
  }
  return p(t.arrow);
}
function Lc(e, n = !1) {
  if (r.tokens[r.tokens.length - 1].contextualKeyword === l._async && a(t.lessThan)) {
    const s = r.snapshot();
    if (Dc() && !r.error)
      return;
    r.restoreFromSnapshot(s);
  }
  tr(e, n);
}
function Dc() {
  r.scopeDepth++;
  const e = r.tokens.length;
  return ht(), cs() ? (Tt(e), !0) : !1;
}
function hr() {
  se(l._enum), r.tokens[r.tokens.length - 1].type = t._enum, P(), Oc();
}
function Oc() {
  oe(l._of) && k(), d(t.braceL), Fc(), d(t.braceR);
}
function Fc() {
  for (; !a(t.braceR) && !r.error && !p(t.ellipsis); )
    jc(), a(t.braceR) || d(t.comma);
}
function jc() {
  P(), p(t.eq) && k();
}
function qc() {
  if (tn(t.eof), r.scopes.push(new Re(0, r.tokens.length, !0)), r.scopeDepth !== 0)
    throw new Error(`Invalid scope depth at end of file: ${r.scopeDepth}`);
  return new Tl(r.tokens, r.scopes);
}
function Ie(e) {
  H && dc() || (a(t.at) && js(), Mc(e));
}
function Mc(e) {
  if (B && na())
    return;
  const n = r.type;
  switch (n) {
    case t._break:
    case t._continue:
      Uc();
      return;
    case t._debugger:
      $c();
      return;
    case t._do:
      Hc();
      return;
    case t._for:
      Vc();
      return;
    case t._function:
      if (Z() === t.dot) break;
      e || j(), Gc();
      return;
    case t._class:
      e || j(), nt(!0);
      return;
    case t._if:
      zc();
      return;
    case t._return:
      Jc();
      return;
    case t._switch:
      Qc();
      return;
    case t._throw:
      Yc();
      return;
    case t._try:
      Kc();
      return;
    case t._let:
    case t._const:
      e || j();
    // NOTE: falls through to _var
    case t._var:
      jt(n !== t._var);
      return;
    case t._while:
      el();
      return;
    case t.braceL:
      ze();
      return;
    case t.semi:
      tl();
      return;
    case t._export:
    case t._import: {
      const i = Z();
      if (i === t.parenL || i === t.dot)
        break;
      k(), n === t._import ? yr() : _r();
      return;
    }
    case t.name:
      if (r.contextualKeyword === l._async) {
        const i = r.start, c = r.snapshot();
        if (k(), a(t._function) && !ye()) {
          d(t._function), tt(i, !0);
          return;
        } else
          r.restoreFromSnapshot(c);
      } else if (r.contextualKeyword === l._using && !g1() && // Statements like `using[0]` and `using in foo` aren't actual using
      // declarations.
      Z() === t.name) {
        jt(!0);
        return;
      } else if (pr()) {
        se(l._await), jt(!0);
        return;
      }
  }
  const s = r.tokens.length;
  le();
  let o = null;
  if (r.tokens.length === s + 1) {
    const i = r.tokens[r.tokens.length - 1];
    i.type === t.name && (o = i.contextualKeyword);
  }
  if (o == null) {
    J();
    return;
  }
  p(t.colon) ? nl() : sl(o);
}
function pr() {
  if (!E(l._await))
    return !1;
  const e = r.snapshot();
  return k(), !E(l._using) || ge() || (k(), !a(t.name) || ge()) ? (r.restoreFromSnapshot(e), !1) : (r.restoreFromSnapshot(e), !0);
}
function js() {
  for (; a(t.at); )
    fr();
}
function fr() {
  if (k(), p(t.parenL))
    le(), d(t.parenR);
  else {
    for (P(); p(t.dot); )
      P();
    Bc();
  }
}
function Bc() {
  B ? ka() : mr();
}
function mr() {
  p(t.parenL) && Ge();
}
function Uc() {
  k(), Ce() || (P(), J());
}
function $c() {
  k(), J();
}
function Hc() {
  k(), Ie(!1), d(t._while), Kt(), p(t.semi);
}
function Vc() {
  r.scopeDepth++;
  const e = r.tokens.length;
  Xc();
  const n = r.tokens.length;
  r.scopes.push(new Re(e, n, !1)), r.scopeDepth--;
}
function Wc() {
  return !(!E(l._using) || fs(l._of));
}
function Xc() {
  k();
  let e = !1;
  if (E(l._await) && (e = !0, k()), d(t.parenL), a(t.semi)) {
    e && j(), Kn();
    return;
  }
  const n = pr();
  if (n || a(t._var) || a(t._let) || a(t._const) || Wc()) {
    if (n && se(l._await), k(), dr(!0, r.type !== t._var), a(t._in) || E(l._of)) {
      u1(e);
      return;
    }
    Kn();
    return;
  }
  if (le(!0), a(t._in) || E(l._of)) {
    u1(e);
    return;
  }
  e && j(), Kn();
}
function Gc() {
  const e = r.start;
  k(), tt(e, !0);
}
function zc() {
  k(), Kt(), Ie(!1), p(t._else) && Ie(!1);
}
function Jc() {
  k(), Ce() || (le(), J());
}
function Qc() {
  k(), Kt(), r.scopeDepth++;
  const e = r.tokens.length;
  for (d(t.braceL); !a(t.braceR) && !r.error; )
    if (a(t._case) || a(t._default)) {
      const s = a(t._case);
      k(), s && le(), d(t.colon);
    } else
      Ie(!0);
  k();
  const n = r.tokens.length;
  r.scopes.push(new Re(e, n, !1)), r.scopeDepth--;
}
function Yc() {
  k(), le(), J();
}
function Zc() {
  Qt(
    !0
    /* isBlockScope */
  ), B && lt();
}
function Kc() {
  if (k(), ze(), a(t._catch)) {
    k();
    let e = null;
    if (a(t.parenL) && (r.scopeDepth++, e = r.tokens.length, d(t.parenL), Zc(), d(t.parenR)), ze(), e != null) {
      const n = r.tokens.length;
      r.scopes.push(new Re(e, n, !1)), r.scopeDepth--;
    }
  }
  p(t._finally) && ze();
}
function jt(e) {
  k(), dr(!1, e), J();
}
function el() {
  k(), Kt(), Ie(!1);
}
function tl() {
  k();
}
function nl() {
  Ie(!0);
}
function sl(e) {
  B ? ra(e) : H ? gc(e) : J();
}
function ze(e = !1, n = 0) {
  const s = r.tokens.length;
  r.scopeDepth++, d(t.braceL), n && (r.tokens[r.tokens.length - 1].contextId = n), tn(t.braceR), n && (r.tokens[r.tokens.length - 1].contextId = n);
  const o = r.tokens.length;
  r.scopes.push(new Re(s, o, e)), r.scopeDepth--;
}
function tn(e) {
  for (; !p(e) && !r.error; )
    Ie(!0);
}
function Kn() {
  d(t.semi), a(t.semi) || le(), d(t.semi), a(t.parenR) || le(), d(t.parenR), Ie(!1);
}
function u1(e) {
  e ? oe(l._of) : k(), le(), d(t.parenR), Ie(!1);
}
function dr(e, n) {
  for (; ; ) {
    if (rl(n), p(t.eq)) {
      const s = r.tokens.length - 1;
      ue(e), r.tokens[s].rhsEndIndex = r.tokens.length;
    }
    if (!p(t.comma))
      break;
  }
}
function rl(e) {
  Qt(e), B ? la() : H && Nc();
}
function tt(e, n, s = !1) {
  a(t.star) && k(), n && !s && !a(t.name) && !a(t._yield) && j();
  let o = null;
  a(t.name) && (n || (o = r.tokens.length, r.scopeDepth++), Je(!1));
  const i = r.tokens.length;
  r.scopeDepth++, ht(), rr(e);
  const c = r.tokens.length;
  r.scopes.push(new Re(i, c, !0)), r.scopeDepth--, o !== null && (r.scopes.push(new Re(o, c, !0)), r.scopeDepth--);
}
function ht(e = !1, n = 0) {
  B ? ca() : H && vc(), d(t.parenL), n && (r.tokens[r.tokens.length - 1].contextId = n), gs(
    t.parenR,
    !1,
    !1,
    e,
    n
  ), n && (r.tokens[r.tokens.length - 1].contextId = n);
}
function nt(e, n = !1) {
  const s = yt();
  k(), r.tokens[r.tokens.length - 1].contextId = s, r.tokens[r.tokens.length - 1].isExpression = !e;
  let o = null;
  e || (o = r.tokens.length, r.scopeDepth++), cl(e, n), ll();
  const i = r.tokens.length;
  if (ol(s), !r.error && (r.tokens[i].contextId = s, r.tokens[r.tokens.length - 1].contextId = s, o !== null)) {
    const c = r.tokens.length;
    r.scopes.push(new Re(o, c, !1)), r.scopeDepth--;
  }
}
function kr() {
  return a(t.eq) || a(t.semi) || a(t.braceR) || a(t.bang) || a(t.colon);
}
function gr() {
  return a(t.parenL) || a(t.lessThan);
}
function ol(e) {
  for (d(t.braceL); !p(t.braceR) && !r.error; ) {
    if (p(t.semi))
      continue;
    if (a(t.at)) {
      fr();
      continue;
    }
    const n = r.start;
    il(n, e);
  }
}
function il(e, n) {
  B && _s([
    l._declare,
    l._public,
    l._protected,
    l._private,
    l._override
  ]);
  let s = !1;
  if (a(t.name) && r.contextualKeyword === l._static) {
    if (P(), gr()) {
      gt(
        e,
        /* isConstructor */
        !1
      );
      return;
    } else if (kr()) {
      qt();
      return;
    }
    if (r.tokens[r.tokens.length - 1].type = t._static, s = !0, a(t.braceL)) {
      r.tokens[r.tokens.length - 1].contextId = n, ze();
      return;
    }
  }
  al(e, s, n);
}
function al(e, n, s) {
  if (B && sa(n))
    return;
  if (p(t.star)) {
    kt(s), gt(
      e,
      /* isConstructor */
      !1
    );
    return;
  }
  kt(s);
  let o = !1;
  const i = r.tokens[r.tokens.length - 1];
  i.contextualKeyword === l._constructor && (o = !0), h1(), gr() ? gt(e, o) : kr() ? qt() : i.contextualKeyword === l._async && !Ce() ? (r.tokens[r.tokens.length - 1].type = t._async, a(t.star) && k(), kt(s), h1(), gt(
    e,
    !1
    /* isConstructor */
  )) : (i.contextualKeyword === l._get || i.contextualKeyword === l._set) && !(Ce() && a(t.star)) ? (i.contextualKeyword === l._get ? r.tokens[r.tokens.length - 1].type = t._get : r.tokens[r.tokens.length - 1].type = t._set, kt(s), gt(
    e,
    /* isConstructor */
    !1
  )) : i.contextualKeyword === l._accessor && !Ce() ? (kt(s), qt()) : Ce() ? qt() : j();
}
function gt(e, n) {
  B ? st() : H && a(t.lessThan) && Se(), ls(e, n);
}
function kt(e) {
  wt(e);
}
function h1() {
  if (B) {
    const e = M(0);
    p(t.question), q(e);
  }
}
function qt() {
  if (B ? (b1(t.bang), lt()) : H && a(t.colon) && rt(), a(t.eq)) {
    const e = r.tokens.length;
    k(), ue(), r.tokens[e].rhsEndIndex = r.tokens.length;
  }
  J();
}
function cl(e, n = !1) {
  B && (!e || n) && E(l._implements) || (a(t.name) && Je(!0), B ? st() : H && a(t.lessThan) && Se());
}
function ll() {
  let e = !1;
  p(t._extends) ? (er(), e = !0) : e = !1, B ? ia(e) : H && wc(e);
}
function _r() {
  const e = r.tokens.length - 1;
  B && Zi() || (fl() ? ml() : pl() ? (P(), a(t.comma) && Z() === t.star ? (d(t.comma), d(t.star), se(l._as), P()) : xr(), At()) : p(t._default) ? ul() : kl() ? hl() : (qs(), At()), r.tokens[e].rhsEndIndex = r.tokens.length);
}
function ul() {
  if (B && ta() || H && kc())
    return;
  const e = r.start;
  p(t._function) ? tt(e, !0, !0) : E(l._async) && Z() === t._function ? (oe(l._async), p(t._function), tt(e, !0, !0)) : a(t._class) ? nt(!0, !0) : a(t.at) ? (js(), nt(!0, !0)) : (ue(), J());
}
function hl() {
  B ? oa() : H ? yc() : Ie(!0);
}
function pl() {
  if (B && z1())
    return !1;
  if (H && xc())
    return !1;
  if (a(t.name))
    return r.contextualKeyword !== l._async;
  if (!a(t._default))
    return !1;
  const e = ms(), n = St(), s = n.type === t.name && n.contextualKeyword === l._from;
  if (n.type === t.comma)
    return !0;
  if (s) {
    const o = b.charCodeAt(w1(e + 4));
    return o === u.quotationMark || o === u.apostrophe;
  }
  return !1;
}
function xr() {
  p(t.comma) && qs();
}
function At() {
  oe(l._from) && (Me(), Ir()), J();
}
function fl() {
  return H ? Ic() : a(t.star);
}
function ml() {
  H ? bc() : ps();
}
function ps() {
  d(t.star), E(l._as) ? dl() : At();
}
function dl() {
  k(), r.tokens[r.tokens.length - 1].type = t._as, P(), xr(), At();
}
function kl() {
  return B && z1() || H && _c() || r.type === t._var || r.type === t._const || r.type === t._let || r.type === t._function || r.type === t._class || E(l._async) || a(t.at);
}
function qs() {
  let e = !0;
  for (d(t.braceL); !p(t.braceR) && !r.error; ) {
    if (e)
      e = !1;
    else if (d(t.comma), p(t.braceR))
      break;
    gl();
  }
}
function gl() {
  if (B) {
    ea();
    return;
  }
  P(), r.tokens[r.tokens.length - 1].identifierRole = v.ExportAccess, oe(l._as) && P();
}
function _l() {
  const e = r.snapshot();
  return se(l._module), oe(l._from) ? E(l._from) ? (r.restoreFromSnapshot(e), !0) : (r.restoreFromSnapshot(e), !1) : a(t.comma) ? (r.restoreFromSnapshot(e), !1) : (r.restoreFromSnapshot(e), !0);
}
function xl() {
  E(l._module) && _l() && k();
}
function yr() {
  if (B && a(t.name) && Z() === t.eq) {
    is();
    return;
  }
  if (B && E(l._type)) {
    const e = St();
    if (e.type === t.name && e.contextualKeyword !== l._from) {
      if (se(l._type), Z() === t.eq) {
        is();
        return;
      }
    } else (e.type === t.star || e.type === t.braceL) && se(l._type);
  }
  a(t.string) || (xl(), Il(), se(l._from)), Me(), Ir(), J();
}
function yl() {
  return a(t.name);
}
function p1() {
  Bt();
}
function Il() {
  H && Ec();
  let e = !0;
  if (!(yl() && (p1(), !p(t.comma)))) {
    if (a(t.star)) {
      k(), se(l._as), p1();
      return;
    }
    for (d(t.braceL); !p(t.braceR) && !r.error; ) {
      if (e)
        e = !1;
      else if (p(t.colon) && j(
        "ES2015 named imports do not destructure. Use another statement for destructuring after the import."
      ), d(t.comma), p(t.braceR))
        break;
      bl();
    }
  }
}
function bl() {
  if (B) {
    Ki();
    return;
  }
  if (H) {
    Sc();
    return;
  }
  Bt(), E(l._as) && (r.tokens[r.tokens.length - 1].identifierRole = v.ImportAccess, k(), Bt());
}
function Ir() {
  (a(t._with) || E(l._assert) && !ge()) && (k(), vs(!1, !1));
}
function wl() {
  return r.pos === 0 && b.charCodeAt(0) === u.numberSign && b.charCodeAt(1) === u.exclamationMark && E1(2), A1(), qc();
}
class Tl {
  constructor(n, s) {
    this.tokens = n, this.scopes = s;
  }
}
function Al(e, n, s, o) {
  if (o && s)
    throw new Error("Cannot combine flow and typescript plugins.");
  zr(e, n, s, o);
  const i = wl();
  if (r.error)
    throw Wr(r.error);
  return i;
}
function El(e) {
  let n = e.currentIndex(), s = 0;
  const o = e.currentToken();
  do {
    const i = e.tokens[n];
    if (i.isOptionalChainStart && s++, i.isOptionalChainEnd && s--, s += i.numNullishCoalesceStarts, s -= i.numNullishCoalesceEnds, i.contextualKeyword === l._await && i.identifierRole == null && i.scopeDepth === o.scopeDepth)
      return !0;
    n += 1;
  } while (s > 0 && n < e.tokens.length);
  return !1;
}
class _t {
  __init() {
    this.resultCode = "";
  }
  // Array mapping input token index to optional string index position in the
  // output code.
  __init2() {
    this.resultMappings = new Array(this.tokens.length);
  }
  __init3() {
    this.tokenIndex = 0;
  }
  constructor(n, s, o, i, c) {
    this.code = n, this.tokens = s, this.isFlowEnabled = o, this.disableESTransforms = i, this.helperManager = c, _t.prototype.__init.call(this), _t.prototype.__init2.call(this), _t.prototype.__init3.call(this);
  }
  /**
   * Snapshot the token state in a way that can be restored later, useful for
   * things like lookahead.
   *
   * resultMappings do not need to be copied since in all use cases, they will
   * be overwritten anyway after restore.
   */
  snapshot() {
    return {
      resultCode: this.resultCode,
      tokenIndex: this.tokenIndex
    };
  }
  restoreToSnapshot(n) {
    this.resultCode = n.resultCode, this.tokenIndex = n.tokenIndex;
  }
  /**
   * Remove and return the code generated since the snapshot, leaving the
   * current token position in-place. Unlike most TokenProcessor operations,
   * this operation can result in input/output line number mismatches because
   * the removed code may contain newlines, so this operation should be used
   * sparingly.
   */
  dangerouslyGetAndRemoveCodeSinceSnapshot(n) {
    const s = this.resultCode.slice(n.resultCode.length);
    return this.resultCode = n.resultCode, s;
  }
  reset() {
    this.resultCode = "", this.resultMappings = new Array(this.tokens.length), this.tokenIndex = 0;
  }
  matchesContextualAtIndex(n, s) {
    return this.matches1AtIndex(n, t.name) && this.tokens[n].contextualKeyword === s;
  }
  identifierNameAtIndex(n) {
    return this.identifierNameForToken(this.tokens[n]);
  }
  identifierNameAtRelativeIndex(n) {
    return this.identifierNameForToken(this.tokenAtRelativeIndex(n));
  }
  identifierName() {
    return this.identifierNameForToken(this.currentToken());
  }
  identifierNameForToken(n) {
    return this.code.slice(n.start, n.end);
  }
  rawCodeForToken(n) {
    return this.code.slice(n.start, n.end);
  }
  stringValueAtIndex(n) {
    return this.stringValueForToken(this.tokens[n]);
  }
  stringValue() {
    return this.stringValueForToken(this.currentToken());
  }
  stringValueForToken(n) {
    return this.code.slice(n.start + 1, n.end - 1);
  }
  matches1AtIndex(n, s) {
    return this.tokens[n].type === s;
  }
  matches2AtIndex(n, s, o) {
    return this.tokens[n].type === s && this.tokens[n + 1].type === o;
  }
  matches3AtIndex(n, s, o, i) {
    return this.tokens[n].type === s && this.tokens[n + 1].type === o && this.tokens[n + 2].type === i;
  }
  matches1(n) {
    return this.tokens[this.tokenIndex].type === n;
  }
  matches2(n, s) {
    return this.tokens[this.tokenIndex].type === n && this.tokens[this.tokenIndex + 1].type === s;
  }
  matches3(n, s, o) {
    return this.tokens[this.tokenIndex].type === n && this.tokens[this.tokenIndex + 1].type === s && this.tokens[this.tokenIndex + 2].type === o;
  }
  matches4(n, s, o, i) {
    return this.tokens[this.tokenIndex].type === n && this.tokens[this.tokenIndex + 1].type === s && this.tokens[this.tokenIndex + 2].type === o && this.tokens[this.tokenIndex + 3].type === i;
  }
  matches5(n, s, o, i, c) {
    return this.tokens[this.tokenIndex].type === n && this.tokens[this.tokenIndex + 1].type === s && this.tokens[this.tokenIndex + 2].type === o && this.tokens[this.tokenIndex + 3].type === i && this.tokens[this.tokenIndex + 4].type === c;
  }
  matchesContextual(n) {
    return this.matchesContextualAtIndex(this.tokenIndex, n);
  }
  matchesContextIdAndLabel(n, s) {
    return this.matches1(n) && this.currentToken().contextId === s;
  }
  previousWhitespaceAndComments() {
    let n = this.code.slice(
      this.tokenIndex > 0 ? this.tokens[this.tokenIndex - 1].end : 0,
      this.tokenIndex < this.tokens.length ? this.tokens[this.tokenIndex].start : this.code.length
    );
    return this.isFlowEnabled && (n = n.replace(/@flow/g, "")), n;
  }
  replaceToken(n) {
    this.resultCode += this.previousWhitespaceAndComments(), this.appendTokenPrefix(), this.resultMappings[this.tokenIndex] = this.resultCode.length, this.resultCode += n, this.appendTokenSuffix(), this.tokenIndex++;
  }
  replaceTokenTrimmingLeftWhitespace(n) {
    this.resultCode += this.previousWhitespaceAndComments().replace(/[^\r\n]/g, ""), this.appendTokenPrefix(), this.resultMappings[this.tokenIndex] = this.resultCode.length, this.resultCode += n, this.appendTokenSuffix(), this.tokenIndex++;
  }
  removeInitialToken() {
    this.replaceToken("");
  }
  removeToken() {
    this.replaceTokenTrimmingLeftWhitespace("");
  }
  /**
   * Remove all code until the next }, accounting for balanced braces.
   */
  removeBalancedCode() {
    let n = 0;
    for (; !this.isAtEnd(); ) {
      if (this.matches1(t.braceL))
        n++;
      else if (this.matches1(t.braceR)) {
        if (n === 0)
          return;
        n--;
      }
      this.removeToken();
    }
  }
  copyExpectedToken(n) {
    if (this.tokens[this.tokenIndex].type !== n)
      throw new Error(`Expected token ${n}`);
    this.copyToken();
  }
  copyToken() {
    this.resultCode += this.previousWhitespaceAndComments(), this.appendTokenPrefix(), this.resultMappings[this.tokenIndex] = this.resultCode.length, this.resultCode += this.code.slice(
      this.tokens[this.tokenIndex].start,
      this.tokens[this.tokenIndex].end
    ), this.appendTokenSuffix(), this.tokenIndex++;
  }
  copyTokenWithPrefix(n) {
    this.resultCode += this.previousWhitespaceAndComments(), this.appendTokenPrefix(), this.resultCode += n, this.resultMappings[this.tokenIndex] = this.resultCode.length, this.resultCode += this.code.slice(
      this.tokens[this.tokenIndex].start,
      this.tokens[this.tokenIndex].end
    ), this.appendTokenSuffix(), this.tokenIndex++;
  }
  appendTokenPrefix() {
    const n = this.currentToken();
    if ((n.numNullishCoalesceStarts || n.isOptionalChainStart) && (n.isAsyncOperation = El(this)), !this.disableESTransforms) {
      if (n.numNullishCoalesceStarts)
        for (let s = 0; s < n.numNullishCoalesceStarts; s++)
          n.isAsyncOperation ? (this.resultCode += "await ", this.resultCode += this.helperManager.getHelperName("asyncNullishCoalesce")) : this.resultCode += this.helperManager.getHelperName("nullishCoalesce"), this.resultCode += "(";
      n.isOptionalChainStart && (n.isAsyncOperation && (this.resultCode += "await "), this.tokenIndex > 0 && this.tokenAtRelativeIndex(-1).type === t._delete ? n.isAsyncOperation ? this.resultCode += this.helperManager.getHelperName("asyncOptionalChainDelete") : this.resultCode += this.helperManager.getHelperName("optionalChainDelete") : n.isAsyncOperation ? this.resultCode += this.helperManager.getHelperName("asyncOptionalChain") : this.resultCode += this.helperManager.getHelperName("optionalChain"), this.resultCode += "([");
    }
  }
  appendTokenSuffix() {
    const n = this.currentToken();
    if (n.isOptionalChainEnd && !this.disableESTransforms && (this.resultCode += "])"), n.numNullishCoalesceEnds && !this.disableESTransforms)
      for (let s = 0; s < n.numNullishCoalesceEnds; s++)
        this.resultCode += "))";
  }
  appendCode(n) {
    this.resultCode += n;
  }
  currentToken() {
    return this.tokens[this.tokenIndex];
  }
  currentTokenCode() {
    const n = this.currentToken();
    return this.code.slice(n.start, n.end);
  }
  tokenAtRelativeIndex(n) {
    return this.tokens[this.tokenIndex + n];
  }
  currentIndex() {
    return this.tokenIndex;
  }
  /**
   * Move to the next token. Only suitable in preprocessing steps. When
   * generating new code, you should use copyToken or removeToken.
   */
  nextToken() {
    if (this.tokenIndex === this.tokens.length)
      throw new Error("Unexpectedly reached end of input.");
    this.tokenIndex++;
  }
  previousToken() {
    this.tokenIndex--;
  }
  finish() {
    if (this.tokenIndex !== this.tokens.length)
      throw new Error("Tried to finish processing tokens before reaching the end.");
    return this.resultCode += this.previousWhitespaceAndComments(), { code: this.resultCode, mappings: this.resultMappings };
  }
  isAtEnd() {
    return this.tokenIndex === this.tokens.length;
  }
}
function Sl(e, n, s, o) {
  const i = n.snapshot(), c = vl(n);
  let h = [];
  const m = [], g = [];
  let f = null;
  const y = [], T = [], S = n.currentToken().contextId;
  if (S == null)
    throw new Error("Expected non-null class context ID on class open-brace.");
  for (n.nextToken(); !n.matchesContextIdAndLabel(t.braceR, S); )
    if (n.matchesContextual(l._constructor) && !n.currentToken().isType)
      ({ constructorInitializerStatements: h, constructorInsertPos: f } = f1(n));
    else if (n.matches1(t.semi))
      o || T.push({ start: n.currentIndex(), end: n.currentIndex() + 1 }), n.nextToken();
    else if (n.currentToken().isType)
      n.nextToken();
    else {
      const C = n.currentIndex();
      let U = !1, V = !1, re = !1;
      for (; Xt(n.currentToken()); )
        n.matches1(t._static) && (U = !0), n.matches1(t.hash) && (V = !0), (n.matches1(t._declare) || n.matches1(t._abstract)) && (re = !0), n.nextToken();
      if (U && n.matches1(t.braceL)) {
        es(n, S);
        continue;
      }
      if (V) {
        es(n, S);
        continue;
      }
      if (n.matchesContextual(l._constructor) && !n.currentToken().isType) {
        ({ constructorInitializerStatements: h, constructorInsertPos: f } = f1(n));
        continue;
      }
      const ie = n.currentIndex();
      if (Nl(n), n.matches1(t.lessThan) || n.matches1(t.parenL)) {
        es(n, S);
        continue;
      }
      for (; n.currentToken().isType; )
        n.nextToken();
      if (n.matches1(t.eq)) {
        const N = n.currentIndex(), O = n.currentToken().rhsEndIndex;
        if (O == null)
          throw new Error("Expected rhsEndIndex on class field assignment.");
        for (n.nextToken(); n.currentIndex() < O; )
          e.processToken();
        let R;
        U ? (R = s.claimFreeName("__initStatic"), g.push(R)) : (R = s.claimFreeName("__init"), m.push(R)), y.push({
          initializerName: R,
          equalsIndex: N,
          start: ie,
          end: n.currentIndex()
        });
      } else (!o || re) && T.push({ start: C, end: n.currentIndex() });
    }
  return n.restoreToSnapshot(i), o ? {
    headerInfo: c,
    constructorInitializerStatements: h,
    instanceInitializerNames: [],
    staticInitializerNames: [],
    constructorInsertPos: f,
    fields: [],
    rangesToRemove: T
  } : {
    headerInfo: c,
    constructorInitializerStatements: h,
    instanceInitializerNames: m,
    staticInitializerNames: g,
    constructorInsertPos: f,
    fields: y,
    rangesToRemove: T
  };
}
function es(e, n) {
  for (e.nextToken(); e.currentToken().contextId !== n; )
    e.nextToken();
  for (; Xt(e.tokenAtRelativeIndex(-1)); )
    e.previousToken();
}
function vl(e) {
  const n = e.currentToken(), s = n.contextId;
  if (s == null)
    throw new Error("Expected context ID on class token.");
  const o = n.isExpression;
  if (o == null)
    throw new Error("Expected isExpression on class token.");
  let i = null, c = !1;
  for (e.nextToken(), e.matches1(t.name) && (i = e.identifierName()); !e.matchesContextIdAndLabel(t.braceL, s); )
    e.matches1(t._extends) && !e.currentToken().isType && (c = !0), e.nextToken();
  return { isExpression: o, className: i, hasSuperclass: c };
}
function f1(e) {
  const n = [];
  e.nextToken();
  const s = e.currentToken().contextId;
  if (s == null)
    throw new Error("Expected context ID on open-paren starting constructor params.");
  for (; !e.matchesContextIdAndLabel(t.parenR, s); )
    if (e.currentToken().contextId === s) {
      if (e.nextToken(), Xt(e.currentToken())) {
        for (e.nextToken(); Xt(e.currentToken()); )
          e.nextToken();
        const c = e.currentToken();
        if (c.type !== t.name)
          throw new Error("Expected identifier after access modifiers in constructor arg.");
        const h = e.identifierNameForToken(c);
        n.push(`this.${h} = ${h}`);
      }
    } else
      e.nextToken();
  for (e.nextToken(); e.currentToken().isType; )
    e.nextToken();
  let o = e.currentIndex(), i = !1;
  for (; !e.matchesContextIdAndLabel(t.braceR, s); ) {
    if (!i && e.matches2(t._super, t.parenL)) {
      e.nextToken();
      const c = e.currentToken().contextId;
      if (c == null)
        throw new Error("Expected a context ID on the super call");
      for (; !e.matchesContextIdAndLabel(t.parenR, c); )
        e.nextToken();
      o = e.currentIndex(), i = !0;
    }
    e.nextToken();
  }
  return e.nextToken(), { constructorInitializerStatements: n, constructorInsertPos: o };
}
function Xt(e) {
  return [
    t._async,
    t._get,
    t._set,
    t.plus,
    t.minus,
    t._readonly,
    t._static,
    t._public,
    t._private,
    t._protected,
    t._override,
    t._abstract,
    t.star,
    t._declare,
    t.hash
  ].includes(e.type);
}
function Nl(e) {
  if (e.matches1(t.bracketL)) {
    const s = e.currentToken().contextId;
    if (s == null)
      throw new Error("Expected class context ID on computed name open bracket.");
    for (; !e.matchesContextIdAndLabel(t.bracketR, s); )
      e.nextToken();
    e.nextToken();
  } else
    e.nextToken();
}
function br(e) {
  if (e.removeInitialToken(), e.removeToken(), e.removeToken(), e.removeToken(), e.matches1(t.parenL))
    e.removeToken(), e.removeToken(), e.removeToken();
  else
    for (; e.matches1(t.dot); )
      e.removeToken(), e.removeToken();
}
const wr = {
  typeDeclarations: /* @__PURE__ */ new Set(),
  valueDeclarations: /* @__PURE__ */ new Set()
};
function Tr(e) {
  const n = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set();
  for (let o = 0; o < e.tokens.length; o++) {
    const i = e.tokens[o];
    i.type === t.name && I1(i) && (i.isType ? n.add(e.identifierNameForToken(i)) : s.add(e.identifierNameForToken(i)));
  }
  return { typeDeclarations: n, valueDeclarations: s };
}
function Ar(e) {
  let n = e.currentIndex();
  for (; !e.matches1AtIndex(n, t.braceR); )
    n++;
  return e.matchesContextualAtIndex(n + 1, l._from) && e.matches1AtIndex(n + 2, t.string);
}
function Ke(e) {
  (e.matches2(t._with, t.braceL) || e.matches2(t.name, t.braceL) && e.matchesContextual(l._assert)) && (e.removeToken(), e.removeToken(), e.removeBalancedCode(), e.removeToken());
}
function Er(e, n, s, o) {
  if (!e || n)
    return !1;
  const i = s.currentToken();
  if (i.rhsEndIndex == null)
    throw new Error("Expected non-null rhsEndIndex on export token.");
  const c = i.rhsEndIndex - s.currentIndex();
  if (c !== 3 && !(c === 4 && s.matches1AtIndex(i.rhsEndIndex - 1, t.semi)))
    return !1;
  const h = s.tokenAtRelativeIndex(2);
  if (h.type !== t.name)
    return !1;
  const m = s.identifierNameForToken(h);
  return o.typeDeclarations.has(m) && !o.valueDeclarations.has(m);
}
class xt extends Ee {
  __init() {
    this.hadExport = !1;
  }
  __init2() {
    this.hadNamedExport = !1;
  }
  __init3() {
    this.hadDefaultExport = !1;
  }
  constructor(n, s, o, i, c, h, m, g, f, y, T, S) {
    super(), this.rootTransformer = n, this.tokens = s, this.importProcessor = o, this.nameManager = i, this.helperManager = c, this.reactHotLoaderTransformer = h, this.enableLegacyBabel5ModuleInterop = m, this.enableLegacyTypeScriptModuleInterop = g, this.isTypeScriptTransformEnabled = f, this.isFlowTransformEnabled = y, this.preserveDynamicImport = T, this.keepUnusedImports = S, xt.prototype.__init.call(this), xt.prototype.__init2.call(this), xt.prototype.__init3.call(this), this.declarationInfo = f ? Tr(s) : wr;
  }
  getPrefixCode() {
    let n = "";
    return this.hadExport && (n += 'Object.defineProperty(exports, "__esModule", {value: true});'), n;
  }
  getSuffixCode() {
    return this.enableLegacyBabel5ModuleInterop && this.hadDefaultExport && !this.hadNamedExport ? `
module.exports = exports.default;
` : "";
  }
  process() {
    return this.tokens.matches3(t._import, t.name, t.eq) ? this.processImportEquals() : this.tokens.matches1(t._import) ? (this.processImport(), !0) : this.tokens.matches2(t._export, t.eq) ? (this.tokens.replaceToken("module.exports"), !0) : this.tokens.matches1(t._export) && !this.tokens.currentToken().isType ? (this.hadExport = !0, this.processExport()) : this.tokens.matches2(t.name, t.postIncDec) && this.processPostIncDec() ? !0 : this.tokens.matches1(t.name) || this.tokens.matches1(t.jsxName) ? this.processIdentifier() : this.tokens.matches1(t.eq) ? this.processAssignment() : this.tokens.matches1(t.assign) ? this.processComplexAssignment() : this.tokens.matches1(t.preIncDec) ? this.processPreIncDec() : !1;
  }
  processImportEquals() {
    const n = this.tokens.identifierNameAtIndex(this.tokens.currentIndex() + 1);
    return this.importProcessor.shouldAutomaticallyElideImportedName(n) ? br(this.tokens) : this.tokens.replaceToken("const"), !0;
  }
  /**
   * Transform this:
   * import foo, {bar} from 'baz';
   * into
   * var _baz = require('baz'); var _baz2 = _interopRequireDefault(_baz);
   *
   * The import code was already generated in the import preprocessing step, so
   * we just need to look it up.
   */
  processImport() {
    if (this.tokens.matches2(t._import, t.parenL)) {
      if (this.preserveDynamicImport) {
        this.tokens.copyToken();
        return;
      }
      const s = this.enableLegacyTypeScriptModuleInterop ? "" : `${this.helperManager.getHelperName("interopRequireWildcard")}(`;
      this.tokens.replaceToken(`Promise.resolve().then(() => ${s}require`);
      const o = this.tokens.currentToken().contextId;
      if (o == null)
        throw new Error("Expected context ID on dynamic import invocation.");
      for (this.tokens.copyToken(); !this.tokens.matchesContextIdAndLabel(t.parenR, o); )
        this.rootTransformer.processToken();
      this.tokens.replaceToken(s ? ")))" : "))");
      return;
    }
    if (this.removeImportAndDetectIfShouldElide())
      this.tokens.removeToken();
    else {
      const s = this.tokens.stringValue();
      this.tokens.replaceTokenTrimmingLeftWhitespace(this.importProcessor.claimImportCode(s)), this.tokens.appendCode(this.importProcessor.claimImportCode(s));
    }
    Ke(this.tokens), this.tokens.matches1(t.semi) && this.tokens.removeToken();
  }
  /**
   * Erase this import (since any CJS output would be completely different), and
   * return true if this import is should be elided due to being a type-only
   * import. Such imports will not be emitted at all to avoid side effects.
   *
   * Import elision only happens with the TypeScript or Flow transforms enabled.
   *
   * TODO: This function has some awkward overlap with
   *  CJSImportProcessor.pruneTypeOnlyImports , and the two should be unified.
   *  That function handles TypeScript implicit import name elision, and removes
   *  an import if all typical imported names (without `type`) are removed due
   *  to being type-only imports. This function handles Flow import removal and
   *  properly distinguishes `import 'foo'` from `import {} from 'foo'` for TS
   *  purposes.
   *
   * The position should end at the import string.
   */
  removeImportAndDetectIfShouldElide() {
    if (this.tokens.removeInitialToken(), this.tokens.matchesContextual(l._type) && !this.tokens.matches1AtIndex(this.tokens.currentIndex() + 1, t.comma) && !this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 1, l._from))
      return this.removeRemainingImport(), !0;
    if (this.tokens.matches1(t.name) || this.tokens.matches1(t.star))
      return this.removeRemainingImport(), !1;
    if (this.tokens.matches1(t.string))
      return !1;
    let n = !1, s = !1;
    for (; !this.tokens.matches1(t.string); )
      (!n && this.tokens.matches1(t.braceL) || this.tokens.matches1(t.comma)) && (this.tokens.removeToken(), this.tokens.matches1(t.braceR) || (s = !0), (this.tokens.matches2(t.name, t.comma) || this.tokens.matches2(t.name, t.braceR) || this.tokens.matches4(t.name, t.name, t.name, t.comma) || this.tokens.matches4(t.name, t.name, t.name, t.braceR)) && (n = !0)), this.tokens.removeToken();
    return this.keepUnusedImports ? !1 : this.isTypeScriptTransformEnabled ? !n : this.isFlowTransformEnabled ? s && !n : !1;
  }
  removeRemainingImport() {
    for (; !this.tokens.matches1(t.string); )
      this.tokens.removeToken();
  }
  processIdentifier() {
    const n = this.tokens.currentToken();
    if (n.shadowsGlobal)
      return !1;
    if (n.identifierRole === v.ObjectShorthand)
      return this.processObjectShorthand();
    if (n.identifierRole !== v.Access)
      return !1;
    const s = this.importProcessor.getIdentifierReplacement(
      this.tokens.identifierNameForToken(n)
    );
    if (!s)
      return !1;
    let o = this.tokens.currentIndex() + 1;
    for (; o < this.tokens.tokens.length && this.tokens.tokens[o].type === t.parenR; )
      o++;
    return this.tokens.tokens[o].type === t.parenL ? this.tokens.tokenAtRelativeIndex(1).type === t.parenL && this.tokens.tokenAtRelativeIndex(-1).type !== t._new ? (this.tokens.replaceToken(`${s}.call(void 0, `), this.tokens.removeToken(), this.rootTransformer.processBalancedCode(), this.tokens.copyExpectedToken(t.parenR)) : this.tokens.replaceToken(`(0, ${s})`) : this.tokens.replaceToken(s), !0;
  }
  processObjectShorthand() {
    const n = this.tokens.identifierName(), s = this.importProcessor.getIdentifierReplacement(n);
    return s ? (this.tokens.replaceToken(`${n}: ${s}`), !0) : !1;
  }
  processExport() {
    if (this.tokens.matches2(t._export, t._enum) || this.tokens.matches3(t._export, t._const, t._enum))
      return this.hadNamedExport = !0, !1;
    if (this.tokens.matches2(t._export, t._default))
      return this.tokens.matches3(t._export, t._default, t._enum) ? (this.hadDefaultExport = !0, !1) : (this.processExportDefault(), !0);
    if (this.tokens.matches2(t._export, t.braceL))
      return this.processExportBindings(), !0;
    if (this.tokens.matches2(t._export, t.name) && this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 1, l._type)) {
      if (this.tokens.removeInitialToken(), this.tokens.removeToken(), this.tokens.matches1(t.braceL)) {
        for (; !this.tokens.matches1(t.braceR); )
          this.tokens.removeToken();
        this.tokens.removeToken();
      } else
        this.tokens.removeToken(), this.tokens.matches1(t._as) && (this.tokens.removeToken(), this.tokens.removeToken());
      return this.tokens.matchesContextual(l._from) && this.tokens.matches1AtIndex(this.tokens.currentIndex() + 1, t.string) && (this.tokens.removeToken(), this.tokens.removeToken(), Ke(this.tokens)), !0;
    }
    if (this.hadNamedExport = !0, this.tokens.matches2(t._export, t._var) || this.tokens.matches2(t._export, t._let) || this.tokens.matches2(t._export, t._const))
      return this.processExportVar(), !0;
    if (this.tokens.matches2(t._export, t._function) || // export async function
    this.tokens.matches3(t._export, t.name, t._function))
      return this.processExportFunction(), !0;
    if (this.tokens.matches2(t._export, t._class) || this.tokens.matches3(t._export, t._abstract, t._class) || this.tokens.matches2(t._export, t.at))
      return this.processExportClass(), !0;
    if (this.tokens.matches2(t._export, t.star))
      return this.processExportStar(), !0;
    throw new Error("Unrecognized export syntax.");
  }
  processAssignment() {
    const n = this.tokens.currentIndex(), s = this.tokens.tokens[n - 1];
    if (s.isType || s.type !== t.name || s.shadowsGlobal || n >= 2 && this.tokens.matches1AtIndex(n - 2, t.dot) || n >= 2 && [t._var, t._let, t._const].includes(this.tokens.tokens[n - 2].type))
      return !1;
    const o = this.importProcessor.resolveExportBinding(
      this.tokens.identifierNameForToken(s)
    );
    return o ? (this.tokens.copyToken(), this.tokens.appendCode(` ${o} =`), !0) : !1;
  }
  /**
   * Process something like `a += 3`, where `a` might be an exported value.
   */
  processComplexAssignment() {
    const n = this.tokens.currentIndex(), s = this.tokens.tokens[n - 1];
    if (s.type !== t.name || s.shadowsGlobal || n >= 2 && this.tokens.matches1AtIndex(n - 2, t.dot))
      return !1;
    const o = this.importProcessor.resolveExportBinding(
      this.tokens.identifierNameForToken(s)
    );
    return o ? (this.tokens.appendCode(` = ${o}`), this.tokens.copyToken(), !0) : !1;
  }
  /**
   * Process something like `++a`, where `a` might be an exported value.
   */
  processPreIncDec() {
    const n = this.tokens.currentIndex(), s = this.tokens.tokens[n + 1];
    if (s.type !== t.name || s.shadowsGlobal || n + 2 < this.tokens.tokens.length && (this.tokens.matches1AtIndex(n + 2, t.dot) || this.tokens.matches1AtIndex(n + 2, t.bracketL) || this.tokens.matches1AtIndex(n + 2, t.parenL)))
      return !1;
    const o = this.tokens.identifierNameForToken(s), i = this.importProcessor.resolveExportBinding(o);
    return i ? (this.tokens.appendCode(`${i} = `), this.tokens.copyToken(), !0) : !1;
  }
  /**
   * Process something like `a++`, where `a` might be an exported value.
   * This starts at the `a`, not at the `++`.
   */
  processPostIncDec() {
    const n = this.tokens.currentIndex(), s = this.tokens.tokens[n], o = this.tokens.tokens[n + 1];
    if (s.type !== t.name || s.shadowsGlobal || n >= 1 && this.tokens.matches1AtIndex(n - 1, t.dot))
      return !1;
    const i = this.tokens.identifierNameForToken(s), c = this.importProcessor.resolveExportBinding(i);
    if (!c)
      return !1;
    const h = this.tokens.rawCodeForToken(o), m = this.importProcessor.getIdentifierReplacement(i) || i;
    if (h === "++")
      this.tokens.replaceToken(`(${m} = ${c} = ${m} + 1, ${m} - 1)`);
    else if (h === "--")
      this.tokens.replaceToken(`(${m} = ${c} = ${m} - 1, ${m} + 1)`);
    else
      throw new Error(`Unexpected operator: ${h}`);
    return this.tokens.removeToken(), !0;
  }
  processExportDefault() {
    let n = !0;
    if (this.tokens.matches4(t._export, t._default, t._function, t.name) || // export default async function
    this.tokens.matches5(t._export, t._default, t.name, t._function, t.name) && this.tokens.matchesContextualAtIndex(
      this.tokens.currentIndex() + 2,
      l._async
    )) {
      this.tokens.removeInitialToken(), this.tokens.removeToken();
      const s = this.processNamedFunction();
      this.tokens.appendCode(` exports.default = ${s};`);
    } else if (this.tokens.matches4(t._export, t._default, t._class, t.name) || this.tokens.matches5(t._export, t._default, t._abstract, t._class, t.name) || this.tokens.matches3(t._export, t._default, t.at)) {
      this.tokens.removeInitialToken(), this.tokens.removeToken(), this.copyDecorators(), this.tokens.matches1(t._abstract) && this.tokens.removeToken();
      const s = this.rootTransformer.processNamedClass();
      this.tokens.appendCode(` exports.default = ${s};`);
    } else if (Er(
      this.isTypeScriptTransformEnabled,
      this.keepUnusedImports,
      this.tokens,
      this.declarationInfo
    ))
      n = !1, this.tokens.removeInitialToken(), this.tokens.removeToken(), this.tokens.removeToken();
    else if (this.reactHotLoaderTransformer) {
      const s = this.nameManager.claimFreeName("_default");
      this.tokens.replaceToken(`let ${s}; exports.`), this.tokens.copyToken(), this.tokens.appendCode(` = ${s} =`), this.reactHotLoaderTransformer.setExtractedDefaultExportName(s);
    } else
      this.tokens.replaceToken("exports."), this.tokens.copyToken(), this.tokens.appendCode(" =");
    n && (this.hadDefaultExport = !0);
  }
  copyDecorators() {
    for (; this.tokens.matches1(t.at); )
      if (this.tokens.copyToken(), this.tokens.matches1(t.parenL))
        this.tokens.copyExpectedToken(t.parenL), this.rootTransformer.processBalancedCode(), this.tokens.copyExpectedToken(t.parenR);
      else {
        for (this.tokens.copyExpectedToken(t.name); this.tokens.matches1(t.dot); )
          this.tokens.copyExpectedToken(t.dot), this.tokens.copyExpectedToken(t.name);
        this.tokens.matches1(t.parenL) && (this.tokens.copyExpectedToken(t.parenL), this.rootTransformer.processBalancedCode(), this.tokens.copyExpectedToken(t.parenR));
      }
  }
  /**
   * Transform a declaration like `export var`, `export let`, or `export const`.
   */
  processExportVar() {
    this.isSimpleExportVar() ? this.processSimpleExportVar() : this.processComplexExportVar();
  }
  /**
   * Determine if the export is of the form:
   * export var/let/const [varName] = [expr];
   * In other words, determine if function name inference might apply.
   */
  isSimpleExportVar() {
    let n = this.tokens.currentIndex();
    if (n++, n++, !this.tokens.matches1AtIndex(n, t.name))
      return !1;
    for (n++; n < this.tokens.tokens.length && this.tokens.tokens[n].isType; )
      n++;
    return !!this.tokens.matches1AtIndex(n, t.eq);
  }
  /**
   * Transform an `export var` declaration initializing a single variable.
   *
   * For example, this:
   * export const f = () => {};
   * becomes this:
   * const f = () => {}; exports.f = f;
   *
   * The variable is unused (e.g. exports.f has the true value of the export).
   * We need to produce an assignment of this form so that the function will
   * have an inferred name of "f", which wouldn't happen in the more general
   * case below.
   */
  processSimpleExportVar() {
    this.tokens.removeInitialToken(), this.tokens.copyToken();
    const n = this.tokens.identifierName();
    for (; !this.tokens.matches1(t.eq); )
      this.rootTransformer.processToken();
    const s = this.tokens.currentToken().rhsEndIndex;
    if (s == null)
      throw new Error("Expected = token with an end index.");
    for (; this.tokens.currentIndex() < s; )
      this.rootTransformer.processToken();
    this.tokens.appendCode(`; exports.${n} = ${n}`);
  }
  /**
   * Transform normal declaration exports, including handling destructuring.
   * For example, this:
   * export const {x: [a = 2, b], c} = d;
   * becomes this:
   * ({x: [exports.a = 2, exports.b], c: exports.c} = d;)
   */
  processComplexExportVar() {
    this.tokens.removeInitialToken(), this.tokens.removeToken();
    const n = this.tokens.matches1(t.braceL);
    n && this.tokens.appendCode("(");
    let s = 0;
    for (; ; )
      if (this.tokens.matches1(t.braceL) || this.tokens.matches1(t.dollarBraceL) || this.tokens.matches1(t.bracketL))
        s++, this.tokens.copyToken();
      else if (this.tokens.matches1(t.braceR) || this.tokens.matches1(t.bracketR))
        s--, this.tokens.copyToken();
      else {
        if (s === 0 && !this.tokens.matches1(t.name) && !this.tokens.currentToken().isType)
          break;
        if (this.tokens.matches1(t.eq)) {
          const o = this.tokens.currentToken().rhsEndIndex;
          if (o == null)
            throw new Error("Expected = token with an end index.");
          for (; this.tokens.currentIndex() < o; )
            this.rootTransformer.processToken();
        } else {
          const o = this.tokens.currentToken();
          if (y1(o)) {
            const i = this.tokens.identifierName();
            let c = this.importProcessor.getIdentifierReplacement(i);
            if (c === null)
              throw new Error(`Expected a replacement for ${i} in \`export var\` syntax.`);
            eo(o) && (c = `${i}: ${c}`), this.tokens.replaceToken(c);
          } else
            this.rootTransformer.processToken();
        }
      }
    if (n) {
      const o = this.tokens.currentToken().rhsEndIndex;
      if (o == null)
        throw new Error("Expected = token with an end index.");
      for (; this.tokens.currentIndex() < o; )
        this.rootTransformer.processToken();
      this.tokens.appendCode(")");
    }
  }
  /**
   * Transform this:
   * export function foo() {}
   * into this:
   * function foo() {} exports.foo = foo;
   */
  processExportFunction() {
    this.tokens.replaceToken("");
    const n = this.processNamedFunction();
    this.tokens.appendCode(` exports.${n} = ${n};`);
  }
  /**
   * Skip past a function with a name and return that name.
   */
  processNamedFunction() {
    if (this.tokens.matches1(t._function))
      this.tokens.copyToken();
    else if (this.tokens.matches2(t.name, t._function)) {
      if (!this.tokens.matchesContextual(l._async))
        throw new Error("Expected async keyword in function export.");
      this.tokens.copyToken(), this.tokens.copyToken();
    }
    if (this.tokens.matches1(t.star) && this.tokens.copyToken(), !this.tokens.matches1(t.name))
      throw new Error("Expected identifier for exported function name.");
    const n = this.tokens.identifierName();
    if (this.tokens.copyToken(), this.tokens.currentToken().isType)
      for (this.tokens.removeInitialToken(); this.tokens.currentToken().isType; )
        this.tokens.removeToken();
    return this.tokens.copyExpectedToken(t.parenL), this.rootTransformer.processBalancedCode(), this.tokens.copyExpectedToken(t.parenR), this.rootTransformer.processPossibleTypeRange(), this.tokens.copyExpectedToken(t.braceL), this.rootTransformer.processBalancedCode(), this.tokens.copyExpectedToken(t.braceR), n;
  }
  /**
   * Transform this:
   * export class A {}
   * into this:
   * class A {} exports.A = A;
   */
  processExportClass() {
    this.tokens.removeInitialToken(), this.copyDecorators(), this.tokens.matches1(t._abstract) && this.tokens.removeToken();
    const n = this.rootTransformer.processNamedClass();
    this.tokens.appendCode(` exports.${n} = ${n};`);
  }
  /**
   * Transform this:
   * export {a, b as c};
   * into this:
   * exports.a = a; exports.c = b;
   *
   * OR
   *
   * Transform this:
   * export {a, b as c} from './foo';
   * into the pre-generated Object.defineProperty code from the ImportProcessor.
   *
   * For the first case, if the TypeScript transform is enabled, we need to skip
   * exports that are only defined as types.
   */
  processExportBindings() {
    this.tokens.removeInitialToken(), this.tokens.removeToken();
    const n = Ar(this.tokens), s = [];
    for (; ; ) {
      if (this.tokens.matches1(t.braceR)) {
        this.tokens.removeToken();
        break;
      }
      const o = It(this.tokens);
      for (; this.tokens.currentIndex() < o.endIndex; )
        this.tokens.removeToken();
      if (!(o.isType || !n && this.shouldElideExportedIdentifier(o.leftName))) {
        const c = o.rightName;
        c === "default" ? this.hadDefaultExport = !0 : this.hadNamedExport = !0;
        const h = o.leftName, m = this.importProcessor.getIdentifierReplacement(h);
        s.push(`exports.${c} = ${m || h};`);
      }
      if (this.tokens.matches1(t.braceR)) {
        this.tokens.removeToken();
        break;
      }
      if (this.tokens.matches2(t.comma, t.braceR)) {
        this.tokens.removeToken(), this.tokens.removeToken();
        break;
      } else if (this.tokens.matches1(t.comma))
        this.tokens.removeToken();
      else
        throw new Error(`Unexpected token: ${JSON.stringify(this.tokens.currentToken())}`);
    }
    if (this.tokens.matchesContextual(l._from)) {
      this.tokens.removeToken();
      const o = this.tokens.stringValue();
      this.tokens.replaceTokenTrimmingLeftWhitespace(this.importProcessor.claimImportCode(o)), Ke(this.tokens);
    } else
      this.tokens.appendCode(s.join(" "));
    this.tokens.matches1(t.semi) && this.tokens.removeToken();
  }
  processExportStar() {
    for (this.tokens.removeInitialToken(); !this.tokens.matches1(t.string); )
      this.tokens.removeToken();
    const n = this.tokens.stringValue();
    this.tokens.replaceTokenTrimmingLeftWhitespace(this.importProcessor.claimImportCode(n)), Ke(this.tokens), this.tokens.matches1(t.semi) && this.tokens.removeToken();
  }
  shouldElideExportedIdentifier(n) {
    return this.isTypeScriptTransformEnabled && !this.keepUnusedImports && !this.declarationInfo.valueDeclarations.has(n);
  }
}
class Cl extends Ee {
  constructor(n, s, o, i, c, h, m, g) {
    super(), this.tokens = n, this.nameManager = s, this.helperManager = o, this.reactHotLoaderTransformer = i, this.isTypeScriptTransformEnabled = c, this.isFlowTransformEnabled = h, this.keepUnusedImports = m, this.nonTypeIdentifiers = c && !m ? O1(n, g) : /* @__PURE__ */ new Set(), this.declarationInfo = c && !m ? Tr(n) : wr, this.injectCreateRequireForImportRequire = !!g.injectCreateRequireForImportRequire;
  }
  process() {
    if (this.tokens.matches3(t._import, t.name, t.eq))
      return this.processImportEquals();
    if (this.tokens.matches4(t._import, t.name, t.name, t.eq) && this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 1, l._type)) {
      this.tokens.removeInitialToken();
      for (let n = 0; n < 7; n++)
        this.tokens.removeToken();
      return !0;
    }
    if (this.tokens.matches2(t._export, t.eq))
      return this.tokens.replaceToken("module.exports"), !0;
    if (this.tokens.matches5(t._export, t._import, t.name, t.name, t.eq) && this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 2, l._type)) {
      this.tokens.removeInitialToken();
      for (let n = 0; n < 8; n++)
        this.tokens.removeToken();
      return !0;
    }
    if (this.tokens.matches1(t._import))
      return this.processImport();
    if (this.tokens.matches2(t._export, t._default))
      return this.processExportDefault();
    if (this.tokens.matches2(t._export, t.braceL))
      return this.processNamedExports();
    if (this.tokens.matches2(t._export, t.name) && this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 1, l._type)) {
      if (this.tokens.removeInitialToken(), this.tokens.removeToken(), this.tokens.matches1(t.braceL)) {
        for (; !this.tokens.matches1(t.braceR); )
          this.tokens.removeToken();
        this.tokens.removeToken();
      } else
        this.tokens.removeToken(), this.tokens.matches1(t._as) && (this.tokens.removeToken(), this.tokens.removeToken());
      return this.tokens.matchesContextual(l._from) && this.tokens.matches1AtIndex(this.tokens.currentIndex() + 1, t.string) && (this.tokens.removeToken(), this.tokens.removeToken(), Ke(this.tokens)), !0;
    }
    return !1;
  }
  processImportEquals() {
    const n = this.tokens.identifierNameAtIndex(this.tokens.currentIndex() + 1);
    return this.shouldAutomaticallyElideImportedName(n) ? br(this.tokens) : this.injectCreateRequireForImportRequire ? (this.tokens.replaceToken("const"), this.tokens.copyToken(), this.tokens.copyToken(), this.tokens.replaceToken(this.helperManager.getHelperName("require"))) : this.tokens.replaceToken("const"), !0;
  }
  processImport() {
    if (this.tokens.matches2(t._import, t.parenL))
      return !1;
    const n = this.tokens.snapshot();
    if (this.removeImportTypeBindings()) {
      for (this.tokens.restoreToSnapshot(n); !this.tokens.matches1(t.string); )
        this.tokens.removeToken();
      this.tokens.removeToken(), Ke(this.tokens), this.tokens.matches1(t.semi) && this.tokens.removeToken();
    }
    return !0;
  }
  /**
   * Remove type bindings from this import, leaving the rest of the import intact.
   *
   * Return true if this import was ONLY types, and thus is eligible for removal. This will bail out
   * of the replacement operation, so we can return early here.
   */
  removeImportTypeBindings() {
    if (this.tokens.copyExpectedToken(t._import), this.tokens.matchesContextual(l._type) && !this.tokens.matches1AtIndex(this.tokens.currentIndex() + 1, t.comma) && !this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 1, l._from))
      return !0;
    if (this.tokens.matches1(t.string))
      return this.tokens.copyToken(), !1;
    this.tokens.matchesContextual(l._module) && this.tokens.matchesContextualAtIndex(this.tokens.currentIndex() + 2, l._from) && this.tokens.copyToken();
    let n = !1, s = !1, o = !1;
    if (this.tokens.matches1(t.name) && (this.shouldAutomaticallyElideImportedName(this.tokens.identifierName()) ? (this.tokens.removeToken(), this.tokens.matches1(t.comma) && this.tokens.removeToken()) : (n = !0, this.tokens.copyToken(), this.tokens.matches1(t.comma) && (o = !0, this.tokens.removeToken()))), this.tokens.matches1(t.star))
      this.shouldAutomaticallyElideImportedName(this.tokens.identifierNameAtRelativeIndex(2)) ? (this.tokens.removeToken(), this.tokens.removeToken(), this.tokens.removeToken()) : (o && this.tokens.appendCode(","), n = !0, this.tokens.copyExpectedToken(t.star), this.tokens.copyExpectedToken(t.name), this.tokens.copyExpectedToken(t.name));
    else if (this.tokens.matches1(t.braceL)) {
      for (o && this.tokens.appendCode(","), this.tokens.copyToken(); !this.tokens.matches1(t.braceR); ) {
        s = !0;
        const i = It(this.tokens);
        if (i.isType || this.shouldAutomaticallyElideImportedName(i.rightName)) {
          for (; this.tokens.currentIndex() < i.endIndex; )
            this.tokens.removeToken();
          this.tokens.matches1(t.comma) && this.tokens.removeToken();
        } else {
          for (n = !0; this.tokens.currentIndex() < i.endIndex; )
            this.tokens.copyToken();
          this.tokens.matches1(t.comma) && this.tokens.copyToken();
        }
      }
      this.tokens.copyExpectedToken(t.braceR);
    }
    return this.keepUnusedImports ? !1 : this.isTypeScriptTransformEnabled ? !n : this.isFlowTransformEnabled ? s && !n : !1;
  }
  shouldAutomaticallyElideImportedName(n) {
    return this.isTypeScriptTransformEnabled && !this.keepUnusedImports && !this.nonTypeIdentifiers.has(n);
  }
  processExportDefault() {
    if (Er(
      this.isTypeScriptTransformEnabled,
      this.keepUnusedImports,
      this.tokens,
      this.declarationInfo
    ))
      return this.tokens.removeInitialToken(), this.tokens.removeToken(), this.tokens.removeToken(), !0;
    if (!(this.tokens.matches4(t._export, t._default, t._function, t.name) || // export default async function
    this.tokens.matches5(t._export, t._default, t.name, t._function, t.name) && this.tokens.matchesContextualAtIndex(
      this.tokens.currentIndex() + 2,
      l._async
    ) || this.tokens.matches4(t._export, t._default, t._class, t.name) || this.tokens.matches5(t._export, t._default, t._abstract, t._class, t.name)) && this.reactHotLoaderTransformer) {
      const s = this.nameManager.claimFreeName("_default");
      return this.tokens.replaceToken(`let ${s}; export`), this.tokens.copyToken(), this.tokens.appendCode(` ${s} =`), this.reactHotLoaderTransformer.setExtractedDefaultExportName(s), !0;
    }
    return !1;
  }
  /**
   * Handle a statement with one of these forms:
   * export {a, type b};
   * export {c, type d} from 'foo';
   *
   * In both cases, any explicit type exports should be removed. In the first
   * case, we also need to handle implicit export elision for names declared as
   * types. In the second case, we must NOT do implicit named export elision,
   * but we must remove the runtime import if all exports are type exports.
   */
  processNamedExports() {
    if (!this.isTypeScriptTransformEnabled)
      return !1;
    this.tokens.copyExpectedToken(t._export), this.tokens.copyExpectedToken(t.braceL);
    const n = Ar(this.tokens);
    let s = !1;
    for (; !this.tokens.matches1(t.braceR); ) {
      const o = It(this.tokens);
      if (o.isType || !n && this.shouldElideExportedName(o.leftName)) {
        for (; this.tokens.currentIndex() < o.endIndex; )
          this.tokens.removeToken();
        this.tokens.matches1(t.comma) && this.tokens.removeToken();
      } else {
        for (s = !0; this.tokens.currentIndex() < o.endIndex; )
          this.tokens.copyToken();
        this.tokens.matches1(t.comma) && this.tokens.copyToken();
      }
    }
    return this.tokens.copyExpectedToken(t.braceR), !this.keepUnusedImports && n && !s && (this.tokens.removeToken(), this.tokens.removeToken(), Ke(this.tokens)), !0;
  }
  /**
   * ESM elides all imports with the rule that we only elide if we see that it's
   * a type and never see it as a value. This is in contrast to CJS, which
   * elides imports that are completely unknown.
   */
  shouldElideExportedName(n) {
    return this.isTypeScriptTransformEnabled && !this.keepUnusedImports && this.declarationInfo.typeDeclarations.has(n) && !this.declarationInfo.valueDeclarations.has(n);
  }
}
class Pl extends Ee {
  constructor(n, s, o) {
    super(), this.rootTransformer = n, this.tokens = s, this.isImportsTransformEnabled = o;
  }
  process() {
    return this.rootTransformer.processPossibleArrowParamEnd() || this.rootTransformer.processPossibleAsyncArrowWithTypeParams() || this.rootTransformer.processPossibleTypeRange() ? !0 : this.tokens.matches1(t._enum) ? (this.processEnum(), !0) : this.tokens.matches2(t._export, t._enum) ? (this.processNamedExportEnum(), !0) : this.tokens.matches3(t._export, t._default, t._enum) ? (this.processDefaultExportEnum(), !0) : !1;
  }
  /**
   * Handle a declaration like:
   * export enum E ...
   *
   * With this imports transform, this becomes:
   * const E = [[enum]]; exports.E = E;
   *
   * otherwise, it becomes:
   * export const E = [[enum]];
   */
  processNamedExportEnum() {
    if (this.isImportsTransformEnabled) {
      this.tokens.removeInitialToken();
      const n = this.tokens.identifierNameAtRelativeIndex(1);
      this.processEnum(), this.tokens.appendCode(` exports.${n} = ${n};`);
    } else
      this.tokens.copyToken(), this.processEnum();
  }
  /**
   * Handle a declaration like:
   * export default enum E
   *
   * With the imports transform, this becomes:
   * const E = [[enum]]; exports.default = E;
   *
   * otherwise, it becomes:
   * const E = [[enum]]; export default E;
   */
  processDefaultExportEnum() {
    this.tokens.removeInitialToken(), this.tokens.removeToken();
    const n = this.tokens.identifierNameAtRelativeIndex(1);
    this.processEnum(), this.isImportsTransformEnabled ? this.tokens.appendCode(` exports.default = ${n};`) : this.tokens.appendCode(` export default ${n};`);
  }
  /**
   * Transpile flow enums to invoke the "flow-enums-runtime" library.
   *
   * Currently, the transpiled code always uses `require("flow-enums-runtime")`,
   * but if future flexibility is needed, we could expose a config option for
   * this string (similar to configurable JSX). Even when targeting ESM, the
   * default behavior of babel-plugin-transform-flow-enums is to use require
   * rather than injecting an import.
   *
   * Flow enums are quite a bit simpler than TS enums and have some convenient
   * constraints:
   * - Element initializers must be either always present or always absent. That
   *   means that we can use fixed lookahead on the first element (if any) and
   *   assume that all elements are like that.
   * - The right-hand side of an element initializer must be a literal value,
   *   not a complex expression and not referencing other elements. That means
   *   we can simply copy a single token.
   *
   * Enums can be broken up into three basic cases:
   *
   * Mirrored enums:
   * enum E {A, B}
   *   ->
   * const E = require("flow-enums-runtime").Mirrored(["A", "B"]);
   *
   * Initializer enums:
   * enum E {A = 1, B = 2}
   *   ->
   * const E = require("flow-enums-runtime")({A: 1, B: 2});
   *
   * Symbol enums:
   * enum E of symbol {A, B}
   *   ->
   * const E = require("flow-enums-runtime")({A: Symbol("A"), B: Symbol("B")});
   *
   * We can statically detect which of the three cases this is by looking at the
   * "of" declaration (if any) and seeing if the first element has an initializer.
   * Since the other transform details are so similar between the three cases, we
   * use a single implementation and vary the transform within processEnumElement
   * based on case.
   */
  processEnum() {
    this.tokens.replaceToken("const"), this.tokens.copyExpectedToken(t.name);
    let n = !1;
    this.tokens.matchesContextual(l._of) && (this.tokens.removeToken(), n = this.tokens.matchesContextual(l._symbol), this.tokens.removeToken());
    const s = this.tokens.matches3(t.braceL, t.name, t.eq);
    this.tokens.appendCode(' = require("flow-enums-runtime")');
    const o = !n && !s;
    for (this.tokens.replaceTokenTrimmingLeftWhitespace(o ? ".Mirrored([" : "({"); !this.tokens.matches1(t.braceR); ) {
      if (this.tokens.matches1(t.ellipsis)) {
        this.tokens.removeToken();
        break;
      }
      this.processEnumElement(n, s), this.tokens.matches1(t.comma) && this.tokens.copyToken();
    }
    this.tokens.replaceToken(o ? "]);" : "});");
  }
  /**
   * Process an individual enum element, producing either an array element or an
   * object element based on what type of enum this is.
   */
  processEnumElement(n, s) {
    if (n) {
      const o = this.tokens.identifierName();
      this.tokens.copyToken(), this.tokens.appendCode(`: Symbol("${o}")`);
    } else s ? (this.tokens.copyToken(), this.tokens.replaceTokenTrimmingLeftWhitespace(":"), this.tokens.copyToken()) : this.tokens.replaceToken(`"${this.tokens.identifierName()}"`);
  }
}
function Rl(e) {
  let n, s = e[0], o = 1;
  for (; o < e.length; ) {
    const i = e[o], c = e[o + 1];
    if (o += 2, (i === "optionalAccess" || i === "optionalCall") && s == null)
      return;
    i === "access" || i === "optionalAccess" ? (n = s, s = c(s)) : (i === "call" || i === "optionalCall") && (s = c((...h) => s.call(n, ...h)), n = void 0);
  }
  return s;
}
const Lt = "jest", Ll = ["mock", "unmock", "enableAutomock", "disableAutomock"];
class Ms extends Ee {
  __init() {
    this.hoistedFunctionNames = [];
  }
  constructor(n, s, o, i) {
    super(), this.rootTransformer = n, this.tokens = s, this.nameManager = o, this.importProcessor = i, Ms.prototype.__init.call(this);
  }
  process() {
    return this.tokens.currentToken().scopeDepth === 0 && this.tokens.matches4(t.name, t.dot, t.name, t.parenL) && this.tokens.identifierName() === Lt ? Rl([this, "access", (n) => n.importProcessor, "optionalAccess", (n) => n.getGlobalNames, "call", (n) => n(), "optionalAccess", (n) => n.has, "call", (n) => n(Lt)]) ? !1 : this.extractHoistedCalls() : !1;
  }
  getHoistedCode() {
    return this.hoistedFunctionNames.length > 0 ? this.hoistedFunctionNames.map((n) => `${n}();`).join("") : "";
  }
  /**
   * Extracts any methods calls on the jest-object that should be hoisted.
   *
   * According to the jest docs, https://jestjs.io/docs/en/jest-object#jestmockmodulename-factory-options,
   * mock, unmock, enableAutomock, disableAutomock, are the methods that should be hoisted.
   *
   * We do not apply the same checks of the arguments as babel-plugin-jest-hoist does.
   */
  extractHoistedCalls() {
    this.tokens.removeToken();
    let n = !1;
    for (; this.tokens.matches3(t.dot, t.name, t.parenL); ) {
      const s = this.tokens.identifierNameAtIndex(this.tokens.currentIndex() + 1);
      if (Ll.includes(s)) {
        const i = this.nameManager.claimFreeName("__jestHoist");
        this.hoistedFunctionNames.push(i), this.tokens.replaceToken(`function ${i}(){${Lt}.`), this.tokens.copyToken(), this.tokens.copyToken(), this.rootTransformer.processBalancedCode(), this.tokens.copyExpectedToken(t.parenR), this.tokens.appendCode(";}"), n = !1;
      } else
        n ? this.tokens.copyToken() : this.tokens.replaceToken(`${Lt}.`), this.tokens.copyToken(), this.tokens.copyToken(), this.rootTransformer.processBalancedCode(), this.tokens.copyExpectedToken(t.parenR), n = !0;
    }
    return !0;
  }
}
class Dl extends Ee {
  constructor(n) {
    super(), this.tokens = n;
  }
  process() {
    if (this.tokens.matches1(t.num)) {
      const n = this.tokens.currentTokenCode();
      if (n.includes("_"))
        return this.tokens.replaceToken(n.replace(/_/g, "")), !0;
    }
    return !1;
  }
}
class Ol extends Ee {
  constructor(n, s) {
    super(), this.tokens = n, this.nameManager = s;
  }
  process() {
    return this.tokens.matches2(t._catch, t.braceL) ? (this.tokens.copyToken(), this.tokens.appendCode(` (${this.nameManager.claimFreeName("e")})`), !0) : !1;
  }
}
class Fl extends Ee {
  constructor(n, s) {
    super(), this.tokens = n, this.nameManager = s;
  }
  process() {
    if (this.tokens.matches1(t.nullishCoalescing)) {
      const o = this.tokens.currentToken();
      return this.tokens.tokens[o.nullishStartIndex].isAsyncOperation ? this.tokens.replaceTokenTrimmingLeftWhitespace(", async () => (") : this.tokens.replaceTokenTrimmingLeftWhitespace(", () => ("), !0;
    }
    if (this.tokens.matches1(t._delete) && this.tokens.tokenAtRelativeIndex(1).isOptionalChainStart)
      return this.tokens.removeInitialToken(), !0;
    const s = this.tokens.currentToken().subscriptStartIndex;
    if (s != null && this.tokens.tokens[s].isOptionalChainStart && // Super subscripts can't be optional (since super is never null/undefined), and the syntax
    // relies on the subscript being intact, so leave this token alone.
    this.tokens.tokenAtRelativeIndex(-1).type !== t._super) {
      const o = this.nameManager.claimFreeName("_");
      let i;
      if (s > 0 && this.tokens.matches1AtIndex(s - 1, t._delete) && this.isLastSubscriptInChain() ? i = `${o} => delete ${o}` : i = `${o} => ${o}`, this.tokens.tokens[s].isAsyncOperation && (i = `async ${i}`), this.tokens.matches2(t.questionDot, t.parenL) || this.tokens.matches2(t.questionDot, t.lessThan))
        this.justSkippedSuper() && this.tokens.appendCode(".bind(this)"), this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'optionalCall', ${i}`);
      else if (this.tokens.matches2(t.questionDot, t.bracketL))
        this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'optionalAccess', ${i}`);
      else if (this.tokens.matches1(t.questionDot))
        this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'optionalAccess', ${i}.`);
      else if (this.tokens.matches1(t.dot))
        this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'access', ${i}.`);
      else if (this.tokens.matches1(t.bracketL))
        this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'access', ${i}[`);
      else if (this.tokens.matches1(t.parenL))
        this.justSkippedSuper() && this.tokens.appendCode(".bind(this)"), this.tokens.replaceTokenTrimmingLeftWhitespace(`, 'call', ${i}(`);
      else
        throw new Error("Unexpected subscript operator in optional chain.");
      return !0;
    }
    return !1;
  }
  /**
   * Determine if the current token is the last of its chain, so that we know whether it's eligible
   * to have a delete op inserted.
   *
   * We can do this by walking forward until we determine one way or another. Each
   * isOptionalChainStart token must be paired with exactly one isOptionalChainEnd token after it in
   * a nesting way, so we can track depth and walk to the end of the chain (the point where the
   * depth goes negative) and see if any other subscript token is after us in the chain.
   */
  isLastSubscriptInChain() {
    let n = 0;
    for (let s = this.tokens.currentIndex() + 1; ; s++) {
      if (s >= this.tokens.tokens.length)
        throw new Error("Reached the end of the code while finding the end of the access chain.");
      if (this.tokens.tokens[s].isOptionalChainStart ? n++ : this.tokens.tokens[s].isOptionalChainEnd && n--, n < 0)
        return !0;
      if (n === 0 && this.tokens.tokens[s].subscriptStartIndex != null)
        return !1;
    }
  }
  /**
   * Determine if we are the open-paren in an expression like super.a()?.b.
   *
   * We can do this by walking backward to find the previous subscript. If that subscript was
   * preceded by a super, then we must be the subscript after it, so if this is a call expression,
   * we'll need to attach the right context.
   */
  justSkippedSuper() {
    let n = 0, s = this.tokens.currentIndex() - 1;
    for (; ; ) {
      if (s < 0)
        throw new Error(
          "Reached the start of the code while finding the start of the access chain."
        );
      if (this.tokens.tokens[s].isOptionalChainStart ? n-- : this.tokens.tokens[s].isOptionalChainEnd && n++, n < 0)
        return !1;
      if (n === 0 && this.tokens.tokens[s].subscriptStartIndex != null)
        return this.tokens.tokens[s - 1].type === t._super;
      s--;
    }
  }
}
class jl extends Ee {
  constructor(n, s, o, i) {
    super(), this.rootTransformer = n, this.tokens = s, this.importProcessor = o, this.options = i;
  }
  process() {
    const n = this.tokens.currentIndex();
    if (this.tokens.identifierName() === "createReactClass") {
      const s = this.importProcessor && this.importProcessor.getIdentifierReplacement("createReactClass");
      return s ? this.tokens.replaceToken(`(0, ${s})`) : this.tokens.copyToken(), this.tryProcessCreateClassCall(n), !0;
    }
    if (this.tokens.matches3(t.name, t.dot, t.name) && this.tokens.identifierName() === "React" && this.tokens.identifierNameAtIndex(this.tokens.currentIndex() + 2) === "createClass") {
      const s = this.importProcessor && this.importProcessor.getIdentifierReplacement("React") || "React";
      return this.tokens.replaceToken(s), this.tokens.copyToken(), this.tokens.copyToken(), this.tryProcessCreateClassCall(n), !0;
    }
    return !1;
  }
  /**
   * This is called with the token position at the open-paren.
   */
  tryProcessCreateClassCall(n) {
    const s = this.findDisplayName(n);
    s && this.classNeedsDisplayName() && (this.tokens.copyExpectedToken(t.parenL), this.tokens.copyExpectedToken(t.braceL), this.tokens.appendCode(`displayName: '${s}',`), this.rootTransformer.processBalancedCode(), this.tokens.copyExpectedToken(t.braceR), this.tokens.copyExpectedToken(t.parenR));
  }
  findDisplayName(n) {
    return n < 2 ? null : this.tokens.matches2AtIndex(n - 2, t.name, t.eq) ? this.tokens.identifierNameAtIndex(n - 2) : n >= 2 && this.tokens.tokens[n - 2].identifierRole === v.ObjectKey ? this.tokens.identifierNameAtIndex(n - 2) : this.tokens.matches2AtIndex(n - 2, t._export, t._default) ? this.getDisplayNameFromFilename() : null;
  }
  getDisplayNameFromFilename() {
    const s = (this.options.filePath || "unknown").split("/"), o = s[s.length - 1], i = o.lastIndexOf("."), c = i === -1 ? o : o.slice(0, i);
    return c === "index" && s[s.length - 2] ? s[s.length - 2] : c;
  }
  /**
   * We only want to add a display name when this is a function call containing
   * one argument, which is an object literal without `displayName` as an
   * existing key.
   */
  classNeedsDisplayName() {
    let n = this.tokens.currentIndex();
    if (!this.tokens.matches2(t.parenL, t.braceL))
      return !1;
    const s = n + 1, o = this.tokens.tokens[s].contextId;
    if (o == null)
      throw new Error("Expected non-null context ID on object open-brace.");
    for (; n < this.tokens.tokens.length; n++) {
      const i = this.tokens.tokens[n];
      if (i.type === t.braceR && i.contextId === o) {
        n++;
        break;
      }
      if (this.tokens.identifierNameAtIndex(n) === "displayName" && this.tokens.tokens[n].identifierRole === v.ObjectKey && i.contextId === o)
        return !1;
    }
    if (n === this.tokens.tokens.length)
      throw new Error("Unexpected end of input when processing React class.");
    return this.tokens.matches1AtIndex(n, t.parenR) || this.tokens.matches2AtIndex(n, t.comma, t.parenR);
  }
}
class Bs extends Ee {
  __init() {
    this.extractedDefaultExportName = null;
  }
  constructor(n, s) {
    super(), this.tokens = n, this.filePath = s, Bs.prototype.__init.call(this);
  }
  setExtractedDefaultExportName(n) {
    this.extractedDefaultExportName = n;
  }
  getPrefixCode() {
    return `
      (function () {
        var enterModule = require('react-hot-loader').enterModule;
        enterModule && enterModule(module);
      })();`.replace(/\s+/g, " ").trim();
  }
  getSuffixCode() {
    const n = /* @__PURE__ */ new Set();
    for (const o of this.tokens.tokens)
      !o.isType && I1(o) && o.identifierRole !== v.ImportDeclaration && n.add(this.tokens.identifierNameForToken(o));
    const s = Array.from(n).map((o) => ({
      variableName: o,
      uniqueLocalName: o
    }));
    return this.extractedDefaultExportName && s.push({
      variableName: this.extractedDefaultExportName,
      uniqueLocalName: "default"
    }), `
;(function () {
  var reactHotLoader = require('react-hot-loader').default;
  var leaveModule = require('react-hot-loader').leaveModule;
  if (!reactHotLoader) {
    return;
  }
${s.map(
      ({ variableName: o, uniqueLocalName: i }) => `  reactHotLoader.register(${o}, "${i}", ${JSON.stringify(
        this.filePath || ""
      )});`
    ).join(`
`)}
  leaveModule(module);
})();`;
  }
  process() {
    return !1;
  }
}
const ql = /* @__PURE__ */ new Set([
  // Reserved keywords as of ECMAScript 2015
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  // Future reserved keywords
  "enum",
  "implements",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "await",
  // Literals that cannot be used as identifiers
  "false",
  "null",
  "true"
]);
function m1(e) {
  if (e.length === 0 || !Et[e.charCodeAt(0)])
    return !1;
  for (let n = 1; n < e.length; n++)
    if (!Ae[e.charCodeAt(n)])
      return !1;
  return !ql.has(e);
}
class Ml extends Ee {
  constructor(n, s, o) {
    super(), this.rootTransformer = n, this.tokens = s, this.isImportsTransformEnabled = o;
  }
  process() {
    return this.rootTransformer.processPossibleArrowParamEnd() || this.rootTransformer.processPossibleAsyncArrowWithTypeParams() || this.rootTransformer.processPossibleTypeRange() ? !0 : this.tokens.matches1(t._public) || this.tokens.matches1(t._protected) || this.tokens.matches1(t._private) || this.tokens.matches1(t._abstract) || this.tokens.matches1(t._readonly) || this.tokens.matches1(t._override) || this.tokens.matches1(t.nonNullAssertion) ? (this.tokens.removeInitialToken(), !0) : this.tokens.matches1(t._enum) || this.tokens.matches2(t._const, t._enum) ? (this.processEnum(), !0) : this.tokens.matches2(t._export, t._enum) || this.tokens.matches3(t._export, t._const, t._enum) ? (this.processEnum(!0), !0) : !1;
  }
  processEnum(n = !1) {
    for (this.tokens.removeInitialToken(); this.tokens.matches1(t._const) || this.tokens.matches1(t._enum); )
      this.tokens.removeToken();
    const s = this.tokens.identifierName();
    this.tokens.removeToken(), n && !this.isImportsTransformEnabled && this.tokens.appendCode("export "), this.tokens.appendCode(`var ${s}; (function (${s})`), this.tokens.copyExpectedToken(t.braceL), this.processEnumBody(s), this.tokens.copyExpectedToken(t.braceR), n && this.isImportsTransformEnabled ? this.tokens.appendCode(`)(${s} || (exports.${s} = ${s} = {}));`) : this.tokens.appendCode(`)(${s} || (${s} = {}));`);
  }
  /**
   * Transform an enum into equivalent JS. This has complexity in a few places:
   * - TS allows string enums, numeric enums, and a mix of the two styles within an enum.
   * - Enum keys are allowed to be referenced in later enum values.
   * - Enum keys are allowed to be strings.
   * - When enum values are omitted, they should follow an auto-increment behavior.
   */
  processEnumBody(n) {
    let s = null;
    for (; !this.tokens.matches1(t.braceR); ) {
      const { nameStringCode: o, variableName: i } = this.extractEnumKeyInfo(this.tokens.currentToken());
      this.tokens.removeInitialToken(), this.tokens.matches3(t.eq, t.string, t.comma) || this.tokens.matches3(t.eq, t.string, t.braceR) ? this.processStringLiteralEnumMember(n, o, i) : this.tokens.matches1(t.eq) ? this.processExplicitValueEnumMember(n, o, i) : this.processImplicitValueEnumMember(
        n,
        o,
        i,
        s
      ), this.tokens.matches1(t.comma) && this.tokens.removeToken(), i != null ? s = i : s = `${n}[${o}]`;
    }
  }
  /**
   * Detect name information about this enum key, which will be used to determine which code to emit
   * and whether we should declare a variable as part of this declaration.
   *
   * Some cases to keep in mind:
   * - Enum keys can be implicitly referenced later, e.g. `X = 1, Y = X`. In Sucrase, we implement
   *   this by declaring a variable `X` so that later expressions can use it.
   * - In addition to the usual identifier key syntax, enum keys are allowed to be string literals,
   *   e.g. `"hello world" = 3,`. Template literal syntax is NOT allowed.
   * - Even if the enum key is defined as a string literal, it may still be referenced by identifier
   *   later, e.g. `"X" = 1, Y = X`. That means that we need to detect whether or not a string
   *   literal is identifier-like and emit a variable if so, even if the declaration did not use an
   *   identifier.
   * - Reserved keywords like `break` are valid enum keys, but are not valid to be referenced later
   *   and would be a syntax error if we emitted a variable, so we need to skip the variable
   *   declaration in those cases.
   *
   * The variableName return value captures these nuances: if non-null, we can and must emit a
   * variable declaration, and if null, we can't and shouldn't.
   */
  extractEnumKeyInfo(n) {
    if (n.type === t.name) {
      const s = this.tokens.identifierNameForToken(n);
      return {
        nameStringCode: `"${s}"`,
        variableName: m1(s) ? s : null
      };
    } else if (n.type === t.string) {
      const s = this.tokens.stringValueForToken(n);
      return {
        nameStringCode: this.tokens.code.slice(n.start, n.end),
        variableName: m1(s) ? s : null
      };
    } else
      throw new Error("Expected name or string at beginning of enum element.");
  }
  /**
   * Handle an enum member where the RHS is just a string literal (not omitted, not a number, and
   * not a complex expression). This is the typical form for TS string enums, and in this case, we
   * do *not* create a reverse mapping.
   *
   * This is called after deleting the key token, when the token processor is at the equals sign.
   *
   * Example 1:
   * someKey = "some value"
   * ->
   * const someKey = "some value"; MyEnum["someKey"] = someKey;
   *
   * Example 2:
   * "some key" = "some value"
   * ->
   * MyEnum["some key"] = "some value";
   */
  processStringLiteralEnumMember(n, s, o) {
    o != null ? (this.tokens.appendCode(`const ${o}`), this.tokens.copyToken(), this.tokens.copyToken(), this.tokens.appendCode(`; ${n}[${s}] = ${o};`)) : (this.tokens.appendCode(`${n}[${s}]`), this.tokens.copyToken(), this.tokens.copyToken(), this.tokens.appendCode(";"));
  }
  /**
   * Handle an enum member initialized with an expression on the right-hand side (other than a
   * string literal). In these cases, we should transform the expression and emit code that sets up
   * a reverse mapping.
   *
   * The TypeScript implementation of this operation distinguishes between expressions that can be
   * "constant folded" at compile time (i.e. consist of number literals and simple math operations
   * on those numbers) and ones that are dynamic. For constant expressions, it emits the resolved
   * numeric value, and auto-incrementing is only allowed in that case. Evaluating expressions at
   * compile time would add significant complexity to Sucrase, so Sucrase instead leaves the
   * expression as-is, and will later emit something like `MyEnum["previousKey"] + 1` to implement
   * auto-incrementing.
   *
   * This is called after deleting the key token, when the token processor is at the equals sign.
   *
   * Example 1:
   * someKey = 1 + 1
   * ->
   * const someKey = 1 + 1; MyEnum[MyEnum["someKey"] = someKey] = "someKey";
   *
   * Example 2:
   * "some key" = 1 + 1
   * ->
   * MyEnum[MyEnum["some key"] = 1 + 1] = "some key";
   */
  processExplicitValueEnumMember(n, s, o) {
    const i = this.tokens.currentToken().rhsEndIndex;
    if (i == null)
      throw new Error("Expected rhsEndIndex on enum assign.");
    if (o != null) {
      for (this.tokens.appendCode(`const ${o}`), this.tokens.copyToken(); this.tokens.currentIndex() < i; )
        this.rootTransformer.processToken();
      this.tokens.appendCode(
        `; ${n}[${n}[${s}] = ${o}] = ${s};`
      );
    } else {
      for (this.tokens.appendCode(`${n}[${n}[${s}]`), this.tokens.copyToken(); this.tokens.currentIndex() < i; )
        this.rootTransformer.processToken();
      this.tokens.appendCode(`] = ${s};`);
    }
  }
  /**
   * Handle an enum member with no right-hand side expression. In this case, the value is the
   * previous value plus 1, or 0 if there was no previous value. We should also always emit a
   * reverse mapping.
   *
   * Example 1:
   * someKey2
   * ->
   * const someKey2 = someKey1 + 1; MyEnum[MyEnum["someKey2"] = someKey2] = "someKey2";
   *
   * Example 2:
   * "some key 2"
   * ->
   * MyEnum[MyEnum["some key 2"] = someKey1 + 1] = "some key 2";
   */
  processImplicitValueEnumMember(n, s, o, i) {
    let c = i != null ? `${i} + 1` : "0";
    o != null && (this.tokens.appendCode(`const ${o} = ${c}; `), c = o), this.tokens.appendCode(
      `${n}[${n}[${s}] = ${c}] = ${s};`
    );
  }
}
class Gt {
  __init() {
    this.transformers = [];
  }
  __init2() {
    this.generatedVariables = [];
  }
  constructor(n, s, o, i) {
    Gt.prototype.__init.call(this), Gt.prototype.__init2.call(this), this.nameManager = n.nameManager, this.helperManager = n.helperManager;
    const { tokenProcessor: c, importProcessor: h } = n;
    this.tokens = c, this.isImportsTransformEnabled = s.includes("imports"), this.isReactHotLoaderTransformEnabled = s.includes("react-hot-loader"), this.disableESTransforms = !!i.disableESTransforms, i.disableESTransforms || (this.transformers.push(
      new Fl(c, this.nameManager)
    ), this.transformers.push(new Dl(c)), this.transformers.push(new Ol(c, this.nameManager))), s.includes("jsx") && (i.jsxRuntime !== "preserve" && this.transformers.push(
      new Ye(this, c, h, this.nameManager, i)
    ), this.transformers.push(
      new jl(this, c, h, i)
    ));
    let m = null;
    if (s.includes("react-hot-loader")) {
      if (!i.filePath)
        throw new Error("filePath is required when using the react-hot-loader transform.");
      m = new Bs(c, i.filePath), this.transformers.push(m);
    }
    if (s.includes("imports")) {
      if (h === null)
        throw new Error("Expected non-null importProcessor with imports transform enabled.");
      this.transformers.push(
        new xt(
          this,
          c,
          h,
          this.nameManager,
          this.helperManager,
          m,
          o,
          !!i.enableLegacyTypeScriptModuleInterop,
          s.includes("typescript"),
          s.includes("flow"),
          !!i.preserveDynamicImport,
          !!i.keepUnusedImports
        )
      );
    } else
      this.transformers.push(
        new Cl(
          c,
          this.nameManager,
          this.helperManager,
          m,
          s.includes("typescript"),
          s.includes("flow"),
          !!i.keepUnusedImports,
          i
        )
      );
    s.includes("flow") && this.transformers.push(
      new Pl(this, c, s.includes("imports"))
    ), s.includes("typescript") && this.transformers.push(
      new Ml(this, c, s.includes("imports"))
    ), s.includes("jest") && this.transformers.push(
      new Ms(this, c, this.nameManager, h)
    );
  }
  transform() {
    this.tokens.reset(), this.processBalancedCode();
    let s = this.isImportsTransformEnabled ? '"use strict";' : "";
    for (const h of this.transformers)
      s += h.getPrefixCode();
    s += this.helperManager.emitHelpers(), s += this.generatedVariables.map((h) => ` var ${h};`).join("");
    for (const h of this.transformers)
      s += h.getHoistedCode();
    let o = "";
    for (const h of this.transformers)
      o += h.getSuffixCode();
    const i = this.tokens.finish();
    let { code: c } = i;
    if (c.startsWith("#!")) {
      let h = c.indexOf(`
`);
      return h === -1 && (h = c.length, c += `
`), {
        code: c.slice(0, h + 1) + s + c.slice(h + 1) + o,
        // The hashbang line has no tokens, so shifting the tokens to account
        // for prefix can happen normally.
        mappings: this.shiftMappings(i.mappings, s.length)
      };
    } else
      return {
        code: s + c + o,
        mappings: this.shiftMappings(i.mappings, s.length)
      };
  }
  processBalancedCode() {
    let n = 0, s = 0;
    for (; !this.tokens.isAtEnd(); ) {
      if (this.tokens.matches1(t.braceL) || this.tokens.matches1(t.dollarBraceL))
        n++;
      else if (this.tokens.matches1(t.braceR)) {
        if (n === 0)
          return;
        n--;
      }
      if (this.tokens.matches1(t.parenL))
        s++;
      else if (this.tokens.matches1(t.parenR)) {
        if (s === 0)
          return;
        s--;
      }
      this.processToken();
    }
  }
  processToken() {
    if (this.tokens.matches1(t._class)) {
      this.processClass();
      return;
    }
    for (const n of this.transformers)
      if (n.process())
        return;
    this.tokens.copyToken();
  }
  /**
   * Skip past a class with a name and return that name.
   */
  processNamedClass() {
    if (!this.tokens.matches2(t._class, t.name))
      throw new Error("Expected identifier for exported class name.");
    const n = this.tokens.identifierNameAtIndex(this.tokens.currentIndex() + 1);
    return this.processClass(), n;
  }
  processClass() {
    const n = Sl(this, this.tokens, this.nameManager, this.disableESTransforms), s = (n.headerInfo.isExpression || !n.headerInfo.className) && n.staticInitializerNames.length + n.instanceInitializerNames.length > 0;
    let o = n.headerInfo.className;
    s && (o = this.nameManager.claimFreeName("_class"), this.generatedVariables.push(o), this.tokens.appendCode(` (${o} =`));
    const c = this.tokens.currentToken().contextId;
    if (c == null)
      throw new Error("Expected class to have a context ID.");
    for (this.tokens.copyExpectedToken(t._class); !this.tokens.matchesContextIdAndLabel(t.braceL, c); )
      this.processToken();
    this.processClassBody(n, o);
    const h = n.staticInitializerNames.map(
      (m) => `${o}.${m}()`
    );
    s ? this.tokens.appendCode(
      `, ${h.map((m) => `${m}, `).join("")}${o})`
    ) : n.staticInitializerNames.length > 0 && this.tokens.appendCode(` ${h.map((m) => `${m};`).join(" ")}`);
  }
  /**
   * We want to just handle class fields in all contexts, since TypeScript supports them. Later,
   * when some JS implementations support class fields, this should be made optional.
   */
  processClassBody(n, s) {
    const {
      headerInfo: o,
      constructorInsertPos: i,
      constructorInitializerStatements: c,
      fields: h,
      instanceInitializerNames: m,
      rangesToRemove: g
    } = n;
    let f = 0, y = 0;
    const T = this.tokens.currentToken().contextId;
    if (T == null)
      throw new Error("Expected non-null context ID on class.");
    this.tokens.copyExpectedToken(t.braceL), this.isReactHotLoaderTransformEnabled && this.tokens.appendCode(
      "__reactstandin__regenerateByEval(key, code) {this[key] = eval(code);}"
    );
    const S = c.length + m.length > 0;
    if (i === null && S) {
      const C = this.makeConstructorInitCode(
        c,
        m,
        s
      );
      if (o.hasSuperclass) {
        const U = this.nameManager.claimFreeName("args");
        this.tokens.appendCode(
          `constructor(...${U}) { super(...${U}); ${C}; }`
        );
      } else
        this.tokens.appendCode(`constructor() { ${C}; }`);
    }
    for (; !this.tokens.matchesContextIdAndLabel(t.braceR, T); )
      if (f < h.length && this.tokens.currentIndex() === h[f].start) {
        let C = !1;
        for (this.tokens.matches1(t.bracketL) ? this.tokens.copyTokenWithPrefix(`${h[f].initializerName}() {this`) : this.tokens.matches1(t.string) || this.tokens.matches1(t.num) ? (this.tokens.copyTokenWithPrefix(`${h[f].initializerName}() {this[`), C = !0) : this.tokens.copyTokenWithPrefix(`${h[f].initializerName}() {this.`); this.tokens.currentIndex() < h[f].end; )
          C && this.tokens.currentIndex() === h[f].equalsIndex && this.tokens.appendCode("]"), this.processToken();
        this.tokens.appendCode("}"), f++;
      } else if (y < g.length && this.tokens.currentIndex() >= g[y].start) {
        for (this.tokens.currentIndex() < g[y].end && this.tokens.removeInitialToken(); this.tokens.currentIndex() < g[y].end; )
          this.tokens.removeToken();
        y++;
      } else this.tokens.currentIndex() === i ? (this.tokens.copyToken(), S && this.tokens.appendCode(
        `;${this.makeConstructorInitCode(
          c,
          m,
          s
        )};`
      ), this.processToken()) : this.processToken();
    this.tokens.copyExpectedToken(t.braceR);
  }
  makeConstructorInitCode(n, s, o) {
    return [
      ...n,
      ...s.map((i) => `${o}.prototype.${i}.call(this)`)
    ].join(";");
  }
  /**
   * Normally it's ok to simply remove type tokens, but we need to be more careful when dealing with
   * arrow function return types since they can confuse the parser. In that case, we want to move
   * the close-paren to the same line as the arrow.
   *
   * See https://github.com/alangpierce/sucrase/issues/391 for more details.
   */
  processPossibleArrowParamEnd() {
    if (this.tokens.matches2(t.parenR, t.colon) && this.tokens.tokenAtRelativeIndex(1).isType) {
      let n = this.tokens.currentIndex() + 1;
      for (; this.tokens.tokens[n].isType; )
        n++;
      if (this.tokens.matches1AtIndex(n, t.arrow)) {
        for (this.tokens.removeInitialToken(); this.tokens.currentIndex() < n; )
          this.tokens.removeToken();
        return this.tokens.replaceTokenTrimmingLeftWhitespace(") =>"), !0;
      }
    }
    return !1;
  }
  /**
   * An async arrow function might be of the form:
   *
   * async <
   *   T
   * >() => {}
   *
   * in which case, removing the type parameters will cause a syntax error. Detect this case and
   * move the open-paren earlier.
   */
  processPossibleAsyncArrowWithTypeParams() {
    if (!this.tokens.matchesContextual(l._async) && !this.tokens.matches1(t._async))
      return !1;
    const n = this.tokens.tokenAtRelativeIndex(1);
    if (n.type !== t.lessThan || !n.isType)
      return !1;
    let s = this.tokens.currentIndex() + 1;
    for (; this.tokens.tokens[s].isType; )
      s++;
    if (this.tokens.matches1AtIndex(s, t.parenL)) {
      for (this.tokens.replaceToken("async ("), this.tokens.removeInitialToken(); this.tokens.currentIndex() < s; )
        this.tokens.removeToken();
      return this.tokens.removeToken(), this.processBalancedCode(), this.processToken(), !0;
    }
    return !1;
  }
  processPossibleTypeRange() {
    if (this.tokens.currentToken().isType) {
      for (this.tokens.removeInitialToken(); this.tokens.currentToken().isType; )
        this.tokens.removeToken();
      return !0;
    }
    return !1;
  }
  shiftMappings(n, s) {
    for (let o = 0; o < n.length; o++) {
      const i = n[o];
      i !== void 0 && (n[o] = i + s);
    }
    return n;
  }
}
var ts = {}, d1;
function Bl() {
  return d1 || (d1 = 1, (function(e) {
    e.__esModule = !0, e.LinesAndColumns = void 0;
    var n = `
`, s = "\r", o = (
      /** @class */
      (function() {
        function i(c) {
          this.string = c;
          for (var h = [0], m = 0; m < c.length; )
            switch (c[m]) {
              case n:
                m += n.length, h.push(m);
                break;
              case s:
                m += s.length, c[m] === n && (m += n.length), h.push(m);
                break;
              default:
                m++;
                break;
            }
          this.offsets = h;
        }
        return i.prototype.locationForIndex = function(c) {
          if (c < 0 || c > this.string.length)
            return null;
          for (var h = 0, m = this.offsets; m[h + 1] <= c; )
            h++;
          var g = c - m[h];
          return { line: h, column: g };
        }, i.prototype.indexForLocation = function(c) {
          var h = c.line, m = c.column;
          return h < 0 || h >= this.offsets.length || m < 0 || m > this.lengthOfLine(h) ? null : this.offsets[h] + m;
        }, i.prototype.lengthOfLine = function(c) {
          var h = this.offsets[c], m = c === this.offsets.length - 1 ? this.string.length : this.offsets[c + 1];
          return m - h;
        }, i;
      })()
    );
    e.LinesAndColumns = o, e.default = o;
  })(ts)), ts;
}
Bl();
function Ul(e) {
  const n = /* @__PURE__ */ new Set();
  for (let s = 0; s < e.tokens.length; s++)
    e.matches1AtIndex(s, t._import) && !e.matches3AtIndex(s, t._import, t.name, t.eq) && $l(e, s, n);
  return n;
}
function $l(e, n, s) {
  n++, !e.matches1AtIndex(n, t.parenL) && (e.matches1AtIndex(n, t.name) && (s.add(e.identifierNameAtIndex(n)), n++, e.matches1AtIndex(n, t.comma) && n++), e.matches1AtIndex(n, t.star) && (n += 2, s.add(e.identifierNameAtIndex(n)), n++), e.matches1AtIndex(n, t.braceL) && (n++, Hl(e, n, s)));
}
function Hl(e, n, s) {
  for (; ; ) {
    if (e.matches1AtIndex(n, t.braceR))
      return;
    const o = It(e, n);
    if (n = o.endIndex, o.isType || s.add(o.rightName), e.matches2AtIndex(n, t.comma, t.braceR))
      return;
    if (e.matches1AtIndex(n, t.braceR))
      return;
    if (e.matches1AtIndex(n, t.comma))
      n++;
    else
      throw new Error(`Unexpected token: ${JSON.stringify(e.tokens[n])}`);
  }
}
function Wl(e, n) {
  ii(n);
  try {
    const s = Vl(e, n), i = new Gt(
      s,
      n.transforms,
      !!n.enableLegacyBabel5ModuleInterop,
      n
    ).transform();
    let c = { code: i.code };
    if (n.sourceMapOptions) {
      if (!n.filePath)
        throw new Error("filePath must be specified when generating a source map.");
      c = {
        ...c,
        sourceMap: zo(
          i,
          n.filePath,
          n.sourceMapOptions,
          e,
          s.tokenProcessor.tokens
        )
      };
    }
    return c;
  } catch (s) {
    throw n.filePath && (s.message = `Error transforming ${n.filePath}: ${s.message}`), s;
  }
}
function Vl(e, n) {
  const s = n.transforms.includes("jsx"), o = n.transforms.includes("typescript"), i = n.transforms.includes("flow"), c = n.disableESTransforms === !0, h = Al(e, s, o, i), m = h.tokens, g = h.scopes, f = new ds(e, m), y = new Mt(f), T = new _t(
    e,
    m,
    i,
    c,
    y
  ), S = !!n.enableLegacyTypeScriptModuleInterop;
  let C = null;
  return n.transforms.includes("imports") ? (C = new Ze(
    f,
    T,
    S,
    n,
    n.transforms.includes("typescript"),
    !!n.keepUnusedImports,
    y
  ), C.preprocessTokens(), Qs(T, g, C.getGlobalNames()), n.transforms.includes("typescript") && !n.keepUnusedImports && C.pruneTypeOnlyImports()) : n.transforms.includes("typescript") && !n.keepUnusedImports && Qs(T, g, Ul(T)), { tokenProcessor: T, scopes: g, nameManager: f, importProcessor: C, helperManager: y };
}
export {
  Wl as transform
};
