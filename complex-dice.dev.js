// ==UserScript==
// @name         complex-dice-v2-dev
// @author       shimakaze & ZiAzusa
// @version      1.5.0-dev
// @description  复杂骰子表达式求值器实验版。用法: .cd 表达式
// @timestamp    1781136000
// ==/UserScript==

(function () {
"use strict";

// ============================
// 第一部分: Token 类型定义
// ============================
const TokenType = {
  NUMBER:    "NUMBER",
  STRING:    "STRING",
  IDENT:     "IDENT",
  AUTO:      "AUTO",
  TRUE:      "TRUE",
  FALSE:     "FALSE",
  IF:        "IF",
  ELSE:      "ELSE",
  WHILE:     "WHILE",
  FOR:       "FOR",
  FUNCTION:  "FUNCTION",
  RETURN:    "RETURN",
  BREAK:     "BREAK",
  CONTINUE:  "CONTINUE",
  PLUS:      "PLUS",
  MINUS:     "MINUS",
  STAR:      "STAR",
  SLASH:     "SLASH",
  FLOOR_DIV: "FLOOR_DIV",
  PERCENT:   "PERCENT",
  BANG:      "BANG",
  GT:        "GT",
  GTE:       "GTE",
  LT:        "LT",
  LTE:       "LTE",
  EQ:        "EQ",
  NEQ:       "NEQ",
  AND:       "AND",
  OR:        "OR",
  ASSIGN:    "ASSIGN",
  QUESTION:  "QUESTION",
  COLON:     "COLON",
  LPAREN:    "LPAREN",
  RPAREN:    "RPAREN",
  LBRACE:    "LBRACE",
  RBRACE:    "RBRACE",
  LBRACKET:  "LBRACKET",
  RBRACKET:  "RBRACKET",
  COMMA:     "COMMA",
  DOT:       "DOT",
  SEMI:      "SEMI",
  EOF:       "EOF",
};

// ============================
// 第二部分: Lexer (词法分析器)
// ============================
class Lexer {
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.tokens = [];
    this.parenDepth = 0;
    this.bracketDepth = 0;
    this.braceDepth = 0;
  }

  tokenize() {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];

      // 跳过空白（换行保留为语句分隔符）
      if (ch === " " || ch === "\t") {
        this.pos++;
        continue;
      }
      if (ch === "\n") {
        this.pos++;
        if (this.parenDepth === 0 && this.bracketDepth === 0) {
          this.tokens.push({ type: TokenType.SEMI, value: ";" });
        }
        continue;
      }
      if (ch === "\r") {
        this.pos++;
        if (this.pos < this.source.length && this.source[this.pos] === "\n") {
          this.pos++;
        }
        if (this.parenDepth === 0 && this.bracketDepth === 0) {
          this.tokens.push({ type: TokenType.SEMI, value: ";" });
        }
        continue;
      }

      // 数字 (包括整数和浮点数)
      if (this._isDigit(ch)) {
        this.tokens.push(this._readNumber());
        continue;
      }

      // 字符串字面量
      if (ch === '"') {
        if (this.source.slice(this.pos, this.pos + 3) === '"""') {
          this.tokens.push(this._readTripleString());
        } else {
          this.tokens.push(this._readString());
        }
        continue;
      }

      // 单行注释
      if (ch === "#") {
        this._skipComment();
        continue;
      }

      // 标识符或关键字
      if (this._isIdentStart(ch)) {
        this.tokens.push(this._readIdent());
        continue;
      }

      // 运算符和标点
      const tok = this._readOperator();
      if (tok) {
        this.tokens.push(tok);
        continue;
      }

      throw new Error("未识别的字符: '" + ch + "'");
    }

    this.tokens.push({ type: TokenType.EOF, value: "" });
    return this.tokens;
  }

  _isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }

  _isIdentStart(ch) {
    if (!ch) return false;
    if (this._isDigit(ch)) return false;
    return !this._isReservedChar(ch);
  }

  _isIdentPart(ch) {
    if (!ch) return false;
    return !this._isReservedChar(ch);
  }

  _isReservedChar(ch) {
    return ch === " " ||
           ch === "\t" ||
           ch === "\n" ||
           ch === "\r" ||
           ch === '"' ||
           ch === "(" ||
           ch === ")" ||
           ch === "," ||
           ch === ";" ||
           ch === "+" ||
           ch === "-" ||
           ch === "*" ||
           ch === "/" ||
           ch === "%" ||
           ch === "!" ||
           ch === ">" ||
           ch === "<" ||
           ch === "=" ||
           ch === "?" ||
           ch === ":" ||
           ch === "[" ||
           ch === "]" ||
           ch === "{" ||
           ch === "}" ||
           ch === "." ||
           ch === "&" ||
           ch === "|";
  }

  _readNumber() {
    let start = this.pos;
    while (this.pos < this.source.length && this._isDigit(this.source[this.pos])) {
      this.pos++;
    }
    // 小数部分
    if (this.pos < this.source.length && this.source[this.pos] === ".") {
      this.pos++;
      while (this.pos < this.source.length && this._isDigit(this.source[this.pos])) {
        this.pos++;
      }
    }
    const value = Number(this.source.slice(start, this.pos));
    return { type: TokenType.NUMBER, value: value };
  }

  _readString() {
    this.pos++; // 跳过开头的 "
    let start = this.pos;
    while (this.pos < this.source.length && this.source[this.pos] !== '"') {
      if (this.source[this.pos] === "\n" || this.source[this.pos] === "\r") {
        throw new Error("单行字符串不能直接包含换行；如需多行字符串请使用三引号");
      }
      // 支持转义
      if (this.source[this.pos] === "\\" && this.pos + 1 < this.source.length) {
        this.pos += 2; // 跳过转义符和被转义的字符
        continue;
      }
      this.pos++;
    }
    if (this.pos >= this.source.length) {
      throw new Error("字符串未闭合");
    }
    const raw = this.source.slice(start, this.pos);
    this.pos++; // 跳过结尾的 "
    // 处理转义序列（须先将 \\ 替换为占位符，避免 \\n 被错误解析为换行）
    const value = raw.replace(/\\\\/g, "\x00")
                     .replace(/\\n/g, "\n")
                     .replace(/\\t/g, "\t")
                     .replace(/\\"/g, '"')
                     .replace(/\x00/g, "\\");
    return { type: TokenType.STRING, value: value };
  }

  _readTripleString() {
    this.pos += 3; // 跳过开头的 """
    let start = this.pos;
    while (this.pos < this.source.length && this.source.slice(this.pos, this.pos + 3) !== '"""') {
      this.pos++;
    }
    if (this.pos >= this.source.length) {
      throw new Error("三引号字符串未闭合");
    }
    const raw = this.source.slice(start, this.pos);
    this.pos += 3; // 跳过结尾的 """
    const value = raw.replace(/\\\\/g, "\x00")
                     .replace(/\\n/g, "\n")
                     .replace(/\\t/g, "\t")
                     .replace(/\x00/g, "\\");
    return { type: TokenType.STRING, value: value };
  }

  _skipComment() {
    while (this.pos < this.source.length &&
           this.source[this.pos] !== "\n" &&
           this.source[this.pos] !== "\r") {
      this.pos++;
    }
  }

  _readIdent() {
    let start = this.pos;
    while (this.pos < this.source.length && this._isIdentPart(this.source[this.pos])) {
      this.pos++;
    }
    const value = this.source.slice(start, this.pos);
    switch (value) {
      case "auto": return { type: TokenType.AUTO, value: value };
      case "true": return { type: TokenType.TRUE, value: true };
      case "false": return { type: TokenType.FALSE, value: false };
      case "if": return { type: TokenType.IF, value: value };
      case "else": return { type: TokenType.ELSE, value: value };
      case "while": return { type: TokenType.WHILE, value: value };
      case "for": return { type: TokenType.FOR, value: value };
      case "function": return { type: TokenType.FUNCTION, value: value };
      case "return": return { type: TokenType.RETURN, value: value };
      case "break": return { type: TokenType.BREAK, value: value };
      case "continue": return { type: TokenType.CONTINUE, value: value };
      default: return { type: TokenType.IDENT, value: value };
    }
  }

  _readOperator() {
    const ch = this.source[this.pos];

    // 双字符运算符
    if (this.pos + 1 < this.source.length) {
      const two = ch + this.source[this.pos + 1];
      switch (two) {
        case ">=": this.pos += 2; return { type: TokenType.GTE, value: ">=" };
        case "<=": this.pos += 2; return { type: TokenType.LTE, value: "<=" };
        case "==": this.pos += 2; return { type: TokenType.EQ,  value: "==" };
        case "!=": this.pos += 2; return { type: TokenType.NEQ, value: "!=" };
        case "&&": this.pos += 2; return { type: TokenType.AND, value: "&&" };
        case "||": this.pos += 2; return { type: TokenType.OR,  value: "||" };
        case "//": this.pos += 2; return { type: TokenType.FLOOR_DIV, value: "//" };
      }
    }

    // 单字符运算符
    this.pos++;
    switch (ch) {
      case "+": return { type: TokenType.PLUS,     value: "+" };
      case "-": return { type: TokenType.MINUS,    value: "-" };
      case "*": return { type: TokenType.STAR,     value: "*" };
      case "/": return { type: TokenType.SLASH,    value: "/" };
      case "%": return { type: TokenType.PERCENT,  value: "%" };
      case "!": return { type: TokenType.BANG,     value: "!" };
      case ">": return { type: TokenType.GT,       value: ">" };
      case "<": return { type: TokenType.LT,       value: "<" };
      case "=": return { type: TokenType.ASSIGN,   value: "=" };
      case "?": return { type: TokenType.QUESTION, value: "?" };
      case ":": return { type: TokenType.COLON,    value: ":" };
      case "(":
        this.parenDepth++;
        return { type: TokenType.LPAREN,   value: "(" };
      case ")":
        if (this.parenDepth > 0) {
          this.parenDepth--;
        }
        return { type: TokenType.RPAREN,   value: ")" };
      case "[":
        this.bracketDepth++;
        return { type: TokenType.LBRACKET, value: "[" };
      case "]":
        if (this.bracketDepth > 0) {
          this.bracketDepth--;
        }
        return { type: TokenType.RBRACKET, value: "]" };
      case "{":
        this.braceDepth++;
        return { type: TokenType.LBRACE, value: "{" };
      case "}":
        if (this.braceDepth > 0) {
          this.braceDepth--;
        }
        return { type: TokenType.RBRACE, value: "}" };
      case ".":
        return { type: TokenType.DOT, value: "." };
      case ",": return { type: TokenType.COMMA,    value: "," };
      case ";": return { type: TokenType.SEMI,     value: ";" };
      default:  this.pos--; return null;
    }
  }
}

// ============================
// 第三部分: AST 节点类型
// ============================
const ASTType = {
  PROGRAM:           "Program",
  BLOCK_STMT:        "BlockStmt",
  AUTO_DECL:         "AutoDecl",
  EXPR_STMT:         "ExprStmt",
  IF_STMT:           "IfStmt",
  WHILE_STMT:        "WhileStmt",
  FOR_STMT:          "ForStmt",
  FUNCTION_DECL:     "FunctionDecl",
  RETURN_STMT:       "ReturnStmt",
  BREAK_STMT:        "BreakStmt",
  CONTINUE_STMT:     "ContinueStmt",
  ASSIGN_EXPR:       "AssignExpr",
  NUMBER_LITERAL:    "NumberLiteral",
  STRING_LITERAL:    "StringLiteral",
  BOOLEAN_LITERAL:   "BooleanLiteral",
  ARRAY_LITERAL:     "ArrayLiteral",
  MEMBER_EXPR:       "MemberExpr",
  VARIABLE_REF:      "VariableRef",
  BINARY_EXPR:       "BinaryExpr",
  UNARY_EXPR:        "UnaryExpr",
  CONDITIONAL_EXPR:  "ConditionalExpr",
  CALL_EXPR:         "CallExpr",
};

// ============================
// 第四部分: Parser (递归下降语法分析器)
// ============================
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse() {
    const program = this._parseProgram();
    if (this._current().type !== TokenType.EOF) {
      throw new Error("表达式解析完毕后仍有未处理的标记");
    }
    return program;
  }

  _current() {
    return this.tokens[this.pos];
  }

  _advance() {
    const tok = this.tokens[this.pos];
    this.pos++;
    return tok;
  }

  _expect(type) {
    const tok = this._current();
    if (tok.type !== type) {
      throw new Error("语法错误: 期望 " + type + "，实际为 " + tok.type);
    }
    return this._advance();
  }

  _match(...types) {
    if (types.includes(this._current().type)) {
      return this._advance();
    }
    return null;
  }

  _consumeStatementSeparators() {
    while (this._match(TokenType.SEMI)) {
      // 连续分隔符视为空语句，直接跳过
    }
  }

  _parseProgram() {
    const statements = [];
    this._consumeStatementSeparators();

    while (this._current().type !== TokenType.EOF) {
      statements.push(this._parseStatement());
      if (this._current().type === TokenType.EOF) {
        break;
      }
      if (!this._match(TokenType.SEMI)) {
        throw new Error("语法错误: 语句之间需要使用换行或分号分隔");
      }
      this._consumeStatementSeparators();
    }

    if (statements.length === 0) {
      throw new Error("语法错误: 表达式不能为空");
    }

    return {
      type: ASTType.PROGRAM,
      statements,
    };
  }

  _parseStatement() {
    if (this._current().type === TokenType.AUTO) {
      return this._parseAutoDecl();
    }
    if (this._current().type === TokenType.FUNCTION) {
      return this._parseFunctionDecl();
    }
    if (this._current().type === TokenType.IF) {
      return this._parseIfStatement();
    }
    if (this._current().type === TokenType.WHILE) {
      return this._parseWhileStatement();
    }
    if (this._current().type === TokenType.FOR) {
      return this._parseForStatement();
    }
    if (this._current().type === TokenType.RETURN) {
      return this._parseReturnStatement();
    }
    if (this._current().type === TokenType.BREAK) {
      this._advance();
      return { type: ASTType.BREAK_STMT };
    }
    if (this._current().type === TokenType.CONTINUE) {
      this._advance();
      return { type: ASTType.CONTINUE_STMT };
    }
    if (this._current().type === TokenType.LBRACE) {
      return this._parseBlock();
    }
    return this._parseExpressionStatement();
  }

  _parseBlock() {
    this._expect(TokenType.LBRACE);
    const statements = [];
    this._consumeStatementSeparators();
    while (this._current().type !== TokenType.RBRACE) {
      if (this._current().type === TokenType.EOF) {
        throw new Error("语法错误: 代码块缺少右花括号");
      }
      statements.push(this._parseStatement());
      if (this._current().type === TokenType.RBRACE) {
        break;
      }
      if (!this._match(TokenType.SEMI)) {
        throw new Error("语法错误: 语句之间需要使用换行或分号分隔");
      }
      this._consumeStatementSeparators();
    }
    this._expect(TokenType.RBRACE);
    return { type: ASTType.BLOCK_STMT, statements };
  }

  _parseAutoDecl() {
    this._advance(); // auto
    const identTok = this._expect(TokenType.IDENT);
    this._expect(TokenType.ASSIGN);
    const initializer = this._parseAssignment();
    return {
      type: ASTType.AUTO_DECL,
      name: identTok.value,
      initializer,
    };
  }

  _parseFunctionDecl() {
    this._expect(TokenType.FUNCTION);
    const name = this._expect(TokenType.IDENT).value;
    this._expect(TokenType.LPAREN);
    const params = [];
    if (this._current().type !== TokenType.RPAREN) {
      params.push(this._expect(TokenType.IDENT).value);
      while (this._match(TokenType.COMMA)) {
        params.push(this._expect(TokenType.IDENT).value);
      }
    }
    this._expect(TokenType.RPAREN);
    const body = this._parseBlock();
    return {
      type: ASTType.FUNCTION_DECL,
      name,
      params,
      body,
    };
  }

  _parseIfStatement() {
    this._expect(TokenType.IF);
    this._expect(TokenType.LPAREN);
    const test = this._parseAssignment();
    this._expect(TokenType.RPAREN);
    const consequent = this._parseStatementBody();
    let alternate = null;
    if (this._match(TokenType.ELSE)) {
      alternate = this._parseStatementBody();
    }
    return {
      type: ASTType.IF_STMT,
      test,
      consequent,
      alternate,
    };
  }

  _parseWhileStatement() {
    this._expect(TokenType.WHILE);
    this._expect(TokenType.LPAREN);
    const test = this._parseAssignment();
    this._expect(TokenType.RPAREN);
    return {
      type: ASTType.WHILE_STMT,
      test,
      body: this._parseStatementBody(),
    };
  }

  _parseForStatement() {
    this._expect(TokenType.FOR);
    this._expect(TokenType.LPAREN);

    let init = null;
    if (this._current().type !== TokenType.SEMI) {
      init = this._parseForInitializer();
    }
    this._expect(TokenType.SEMI);

    let test = null;
    if (this._current().type !== TokenType.SEMI) {
      test = this._parseAssignment();
    }
    this._expect(TokenType.SEMI);

    let update = null;
    if (this._current().type !== TokenType.RPAREN) {
      update = this._parseAssignment();
    }
    this._expect(TokenType.RPAREN);

    return {
      type: ASTType.FOR_STMT,
      init,
      test,
      update,
      body: this._parseStatementBody(),
    };
  }

  _parseForInitializer() {
    if (this._current().type === TokenType.AUTO) {
      return this._parseAutoDecl();
    }
    return this._parseExpressionStatement();
  }

  _parseReturnStatement() {
    this._expect(TokenType.RETURN);
    let argument = null;
    if (this._current().type !== TokenType.SEMI &&
        this._current().type !== TokenType.RBRACE &&
        this._current().type !== TokenType.EOF) {
      argument = this._parseAssignment();
    }
    return {
      type: ASTType.RETURN_STMT,
      argument,
    };
  }

  _parseStatementBody() {
    if (this._current().type === TokenType.LBRACE) {
      return this._parseBlock();
    }
    return this._parseStatement();
  }

  _parseExpressionStatement() {
    return {
      type: ASTType.EXPR_STMT,
      expression: this._parseAssignment(),
    };
  }

  _parseAssignment() {
    const left = this._parseConditional();
    if (!this._match(TokenType.ASSIGN)) {
      return left;
    }
    if (left.type !== ASTType.VARIABLE_REF && left.type !== ASTType.MEMBER_EXPR) {
      throw new Error("赋值语法错误: 左侧必须是变量或数组成员");
    }
    return {
      type: ASTType.ASSIGN_EXPR,
      target: left,
      value: this._parseAssignment(),
    };
  }

  // 三元条件表达式 (最低优先级)
  // condition ? trueExpr : falseExpr
  _parseConditional() {
    let expr = this._parseLogicalOr();
    if (this._match(TokenType.QUESTION)) {
      const trueExpr = this._parseConditional();
      this._expect(TokenType.COLON);
      const falseExpr = this._parseConditional();
      expr = {
        type: ASTType.CONDITIONAL_EXPR,
        test: expr,
        consequent: trueExpr,
        alternate: falseExpr,
      };
    }
    return expr;
  }

  // 逻辑或 ||
  _parseLogicalOr() {
    let left = this._parseLogicalAnd();
    while (this._match(TokenType.OR)) {
      const right = this._parseLogicalAnd();
      left = { type: ASTType.BINARY_EXPR, operator: "||", left, right };
    }
    return left;
  }

  // 逻辑与 &&
  _parseLogicalAnd() {
    let left = this._parseEquality();
    while (this._match(TokenType.AND)) {
      const right = this._parseEquality();
      left = { type: ASTType.BINARY_EXPR, operator: "&&", left, right };
    }
    return left;
  }

  // 相等比较 == !=
  _parseEquality() {
    let left = this._parseComparison();
    while (true) {
      const tok = this._match(TokenType.EQ, TokenType.NEQ);
      if (!tok) break;
      const right = this._parseComparison();
      left = { type: ASTType.BINARY_EXPR, operator: tok.value, left, right };
    }
    return left;
  }

  // 大小比较 > < >= <=
  _parseComparison() {
    let left = this._parseAddition();
    while (true) {
      const tok = this._match(TokenType.GT, TokenType.GTE, TokenType.LT, TokenType.LTE);
      if (!tok) break;
      const right = this._parseAddition();
      left = { type: ASTType.BINARY_EXPR, operator: tok.value, left, right };
    }
    return left;
  }

  // 加减 + -
  _parseAddition() {
    let left = this._parseMultiplication();
    while (true) {
      const tok = this._match(TokenType.PLUS, TokenType.MINUS);
      if (!tok) break;
      const right = this._parseMultiplication();
      left = { type: ASTType.BINARY_EXPR, operator: tok.value, left, right };
    }
    return left;
  }

  // 乘除取模 * / %
  _parseMultiplication() {
    let left = this._parseUnary();
    while (true) {
      const tok = this._match(TokenType.STAR, TokenType.SLASH, TokenType.FLOOR_DIV, TokenType.PERCENT);
      if (!tok) break;
      const right = this._parseUnary();
      left = { type: ASTType.BINARY_EXPR, operator: tok.value, left, right };
    }
    return left;
  }

  // 一元运算 -x, !x
  _parseUnary() {
    const tok = this._match(TokenType.MINUS, TokenType.BANG);
    if (tok) {
      const argument = this._parseUnary();
      return { type: ASTType.UNARY_EXPR, operator: tok.value, argument };
    }
    return this._parsePostfix();
  }

  // 后缀表达式: 调用、成员访问、下标
  _parsePostfix() {
    let expr = this._parsePrimary();

    while (true) {
      if (this._current().type === TokenType.LPAREN) {
        this._advance();
        const args = [];
        if (this._current().type !== TokenType.RPAREN) {
          args.push(this._parseAssignment());
          while (this._match(TokenType.COMMA)) {
            args.push(this._parseAssignment());
          }
        }
        this._expect(TokenType.RPAREN);
        if (expr.type === ASTType.VARIABLE_REF) {
          expr = {
            type: ASTType.CALL_EXPR,
            name: expr.name,
            args: args,
          };
          continue;
        }
        if (expr.type === ASTType.MEMBER_EXPR) {
          expr = {
            type: ASTType.CALL_EXPR,
            callee: expr,
            args: args,
          };
          continue;
        }
        throw new Error("函数调用语法错误: 目标不可调用");
      }
      if (this._match(TokenType.DOT)) {
        const property = this._expect(TokenType.IDENT);
        expr = {
          type: ASTType.MEMBER_EXPR,
          object: expr,
          property: property.value,
          computed: false,
        };
        continue;
      }
      if (this._match(TokenType.LBRACKET)) {
        const propertyExpr = this._parseAssignment();
        this._expect(TokenType.RBRACKET);
        expr = {
          type: ASTType.MEMBER_EXPR,
          object: expr,
          property: propertyExpr,
          computed: true,
        };
        continue;
      }
      break;
    }

    return expr;
  }

  // 原子表达式: NUMBER, STRING, BOOLEAN, ARRAY, IDENT, ( expr )
  _parsePrimary() {
    if (this._current().type === TokenType.IF) {
      return this._parseIfStatement();
    }
    if (this._current().type === TokenType.WHILE) {
      return this._parseWhileStatement();
    }
    if (this._current().type === TokenType.FOR) {
      return this._parseForStatement();
    }
    if (this._current().type === TokenType.LBRACE) {
      return this._parseBlock();
    }

    // 括号表达式
    if (this._match(TokenType.LPAREN)) {
      const expr = this._parseConditional();
      this._expect(TokenType.RPAREN);
      return expr;
    }

    // 数字
    const numTok = this._match(TokenType.NUMBER);
    if (numTok) {
      return { type: ASTType.NUMBER_LITERAL, value: numTok.value };
    }

    // 字符串
    const strTok = this._match(TokenType.STRING);
    if (strTok) {
      return { type: ASTType.STRING_LITERAL, value: strTok.value };
    }

    const boolTok = this._match(TokenType.TRUE, TokenType.FALSE);
    if (boolTok) {
      return { type: ASTType.BOOLEAN_LITERAL, value: boolTok.value };
    }

    if (this._match(TokenType.LBRACKET)) {
      const elements = [];
      if (this._current().type !== TokenType.RBRACKET) {
        elements.push(this._parseAssignment());
        while (this._match(TokenType.COMMA)) {
          elements.push(this._parseAssignment());
        }
      }
      this._expect(TokenType.RBRACKET);
      return { type: ASTType.ARRAY_LITERAL, elements };
    }

    // 标识符（变量引用 / 函数引用）
    const identTok = this._match(TokenType.IDENT);
    if (identTok) {
      return { type: ASTType.VARIABLE_REF, name: identTok.value };
    }

    throw new Error("语法错误: 不期望的标记 " + JSON.stringify(this._current()));
  }
}

// ============================
// 第五部分: Interpreter (解释器)
// ============================
class Interpreter {
  constructor(builtins, maxVariables, ctx, limits) {
    this.builtins = builtins; // { name: function }
    this.maxVariables = maxVariables;
    this.ctx = ctx;
    this.scope = Object.create(null);
    this.scopes = [this.scope];
    this.sealVarCache = Object.create(null);
    this.limits = limits;
    this.stepCount = 0;
    this.loopCount = 0;
    this.callDepth = 0;
    this.loopDepth = 0;
    this.functionDepth = 0;
  }

  eval(node) {
    this._tick();
    switch (node.type) {
      case ASTType.PROGRAM:
        return this._evalProgram(node);

      case ASTType.BLOCK_STMT:
        return this._evalBlock(node);

      case ASTType.AUTO_DECL:
        return this._evalAutoDecl(node);

      case ASTType.EXPR_STMT:
        return this.eval(node.expression);

      case ASTType.IF_STMT:
        return this._evalIf(node);

      case ASTType.WHILE_STMT:
        return this._evalWhile(node);

      case ASTType.FOR_STMT:
        return this._evalFor(node);

      case ASTType.FUNCTION_DECL:
        return this._evalFunctionDecl(node);

      case ASTType.RETURN_STMT:
        if (this.functionDepth <= 0) {
          throw new Error("return 只能在函数内使用");
        }
        throw new ReturnSignal(node.argument ? this.eval(node.argument) : false);

      case ASTType.BREAK_STMT:
        if (this.loopDepth <= 0) {
          throw new Error("break 只能在循环内使用");
        }
        throw new BreakSignal();

      case ASTType.CONTINUE_STMT:
        if (this.loopDepth <= 0) {
          throw new Error("continue 只能在循环内使用");
        }
        throw new ContinueSignal();

      case ASTType.ASSIGN_EXPR:
        return this._evalAssign(node);

      case ASTType.NUMBER_LITERAL:
        return node.value;

      case ASTType.STRING_LITERAL:
        return node.value;

      case ASTType.BOOLEAN_LITERAL:
        return node.value;

      case ASTType.ARRAY_LITERAL:
        return this._evalArrayLiteral(node);

      case ASTType.MEMBER_EXPR:
        return this._evalMember(node);

      case ASTType.VARIABLE_REF:
        return this._evalVariableRef(node);

      case ASTType.BINARY_EXPR:
        return this._evalBinary(node);

      case ASTType.UNARY_EXPR:
        return this._evalUnary(node);

      case ASTType.CONDITIONAL_EXPR:
        return this._evalConditional(node);

      case ASTType.CALL_EXPR:
        return this._evalCall(node);

      default:
        throw new Error("内部错误: 未知的 AST 节点类型 " + node.type);
    }
  }

  _evalProgram(node) {
    return this._evalStatementList(node.statements);
  }

  _evalBlock(node) {
    return this._withScope(() => this._evalStatementList(node.statements));
  }

  _evalAutoDecl(node) {
    if (Object.prototype.hasOwnProperty.call(this.builtins, node.name)) {
      throw new Error("变量名不能与内置函数重名: " + node.name);
    }
    if (Object.prototype.hasOwnProperty.call(this._currentScope(), node.name)) {
      throw new Error("变量已定义: " + node.name);
    }
    if (Object.keys(this._currentScope()).length >= this.maxVariables) {
      throw new Error("变量数量过多（最大 " + this.maxVariables + " 个）");
    }
    const value = this.eval(node.initializer);
    this._currentScope()[node.name] = value;
    return value;
  }

  _evalAssign(node) {
    const value = this.eval(node.value);
    return this._writeAssignable(node.target, value);
  }

  _evalVariableRef(node) {
    return this._readVariable(node.name);
  }

  _evalFunctionDecl(node) {
    if (Object.prototype.hasOwnProperty.call(this.builtins, node.name)) {
      throw new Error("函数名不能与内置函数重名: " + node.name);
    }
    if (Object.prototype.hasOwnProperty.call(this._currentScope(), node.name)) {
      throw new Error("当前作用域已存在同名变量或函数: " + node.name);
    }
    if (node.params.length > this.limits.maxFunctionParams) {
      throw new Error("函数参数过多（最大 " + this.limits.maxFunctionParams + " 个）");
    }
    const seen = Object.create(null);
    for (let i = 0; i < node.params.length; i++) {
      if (seen[node.params[i]]) {
        throw new Error("函数参数重名: " + node.params[i]);
      }
      seen[node.params[i]] = true;
    }
    const fnValue = {
      type: "user_function",
      name: node.name,
      params: node.params.slice(),
      body: node.body,
    };
    this._currentScope()[node.name] = fnValue;
    return fnValue;
  }

  _evalArrayLiteral(node) {
    const result = [];
    for (let i = 0; i < node.elements.length; i++) {
      if (result.length >= this.limits.maxArrayLength) {
        throw new Error("数组长度过大（最大 " + this.limits.maxArrayLength + " 项）");
      }
      result.push(this.eval(node.elements[i]));
    }
    return result;
  }

  _evalMember(node) {
    const object = this.eval(node.object);
    return this._readMemberValue(object, node);
  }

  _evalSealVariable(name) {
    if (Object.prototype.hasOwnProperty.call(this.sealVarCache, name)) {
      return this.sealVarCache[name];
    }

    const intResult = seal.vars.intGet(this.ctx, name);
    if (Array.isArray(intResult) && intResult.length >= 2 && intResult[1] === true) {
      this.sealVarCache[name] = intResult[0];
      return intResult[0];
    }

    const strResult = seal.vars.strGet(this.ctx, name);
    if (Array.isArray(strResult) && strResult.length >= 2 && strResult[1] === true) {
      this.sealVarCache[name] = strResult[0];
      return strResult[0];
    }

    throw new Error("不存在或类型不匹配的海豹变量: " + name);
  }

  _resolveSealVariableName(name) {
    if (this._canReadSealVariable(name)) {
      return name;
    }

    if (!name.startsWith("$")) {
      const prefixedName = "$" + name;
      if (this._canReadSealVariable(prefixedName)) {
        return prefixedName;
      }
    }

    throw new Error("未定义的变量: " + name);
  }

  _canReadSealVariable(name) {
    return this._tryReadSealVariable(name).ok;
  }

  _tryReadSealVariable(name) {
    const intResult = seal.vars.intGet(this.ctx, name);
    if (Array.isArray(intResult) && intResult.length >= 2 && intResult[1] === true) {
      return { ok: true, value: intResult[0], kind: "int" };
    }

    const strResult = seal.vars.strGet(this.ctx, name);
    if (Array.isArray(strResult) && strResult.length >= 2 && strResult[1] === true) {
      return { ok: true, value: strResult[0], kind: "str" };
    }

    return { ok: false, value: undefined, kind: null };
  }

  _assignSealVariable(name, value) {
    this._assertSealVariableWritable(name);

    const type = typeof value;
    if (type !== "number" && type !== "string") {
      throw new Error("不支持的赋值类型: " + type);
    }

    const attempts = [];
    let lastError = null;

    if (typeof seal.vars.varSet === "function") {
      attempts.push(() => seal.vars.varSet(this.ctx, name, value));
    }
    if (type === "number" && Number.isInteger(value) && typeof seal.vars.intSet === "function") {
      attempts.push(() => seal.vars.intSet(this.ctx, name, value));
    }
    if (type === "string" && typeof seal.vars.strSet === "function") {
      attempts.push(() => seal.vars.strSet(this.ctx, name, value));
    }

    if (attempts.length === 0) {
      throw new Error("海豹变量不支持这种赋值: " + name);
    }

    for (let i = 0; i < attempts.length; i++) {
      try {
        attempts[i]();
      } catch (e) {
        lastError = e;
        continue;
      }

      const verify = this._tryReadSealVariable(name);
      if (verify.ok && this._sealValueEquals(verify.value, value)) {
        return;
      }
    }

    if (type === "number" && !Number.isInteger(value)) {
      throw new Error("海豹变量不支持非整数数值赋值: " + name);
    }

    if (lastError && lastError.message) {
      throw new Error("海豹变量赋值失败: " + name + " (" + lastError.message + ")");
    }
    throw new Error("海豹变量赋值失败或变量不可修改: " + name);
  }

  _assignAnySealVariable(name, value) {
    const candidates = [name];
    if (!name.startsWith("$")) {
      candidates.push("$" + name);
    }

    let lastError = null;
    for (let i = 0; i < candidates.length; i++) {
      try {
        this._assignSealVariable(candidates[i], value);
        return candidates[i];
      } catch (e) {
        lastError = e;
      }
    }

    if (lastError && lastError.message) {
      throw new Error(lastError.message);
    }
    throw new Error("海豹变量赋值失败或变量不可修改: " + name);
  }

  _sealValueEquals(actual, expected) {
    if (typeof expected === "number") {
      return typeof actual === "number" && actual === expected;
    }
    return String(actual) === expected;
  }

  _readVariable(name) {
    return this._readVariableWithPolicy(name, this._canUseImplicitSealFallback());
  }

  _readVariableWithPolicy(name, allowSealFallback) {
    const localValue = this._findScopedValue(name);
    if (localValue.found) {
      return localValue.value;
    }

    if (!allowSealFallback) {
      throw new Error("未定义的变量: " + name);
    }

    const resolvedName = this._resolveSealVariableName(name);
    return this._evalSealVariable(resolvedName);
  }

  _writeVariable(name, value) {
    return this._writeVariableWithPolicy(name, value, this._canUseImplicitSealFallback());
  }

  _writeVariableWithPolicy(name, value, allowSealFallback) {
    if (Object.prototype.hasOwnProperty.call(this.builtins, name)) {
      throw new Error("不能给内置函数赋值: " + name);
    }

    const targetScope = this._findScopeContaining(name);
    if (targetScope) {
      targetScope[name] = value;
      return value;
    }

    if (!allowSealFallback) {
      throw new Error("未定义的变量: " + name);
    }

    const targetName = this._assignAnySealVariable(name, value);
    this.sealVarCache[targetName] = value;
    return value;
  }

  _assertSealVariableWritable(name) {
    if (this._isReadOnlySealVariable(name)) {
      throw new Error("该海豹内置变量为只读: " + name);
    }
    if (this._isGroupScopedSealVariable(name) && !this._hasGroupWritePrivilege()) {
      throw new Error("写入群变量需要权限等级 >= 50: " + name);
    }
  }

  _isGroupScopedSealVariable(name) {
    return /^\$g/u.test(name);
  }

  _isReadOnlySealVariable(name) {
    const normalized = name.startsWith("$") ? name : "$" + name;
    return READONLY_SEAL_VARIABLES.has(name) || READONLY_SEAL_VARIABLES.has(normalized);
  }

  _hasGroupWritePrivilege() {
    return !!(this.ctx && typeof this.ctx.privilegeLevel === "number" && this.ctx.privilegeLevel >= 50);
  }

  _writeAssignable(target, value) {
    if (target.type === ASTType.VARIABLE_REF) {
      return this._writeVariable(target.name, value);
    }
    if (target.type === ASTType.MEMBER_EXPR) {
      return this._writeMember(target, value);
    }
    throw new Error("赋值语法错误: 左侧不可赋值");
  }

  _writeMember(node, value) {
    const object = this.eval(node.object);
    const property = this._resolveMemberKey(node, object);
    if (!Array.isArray(object)) {
      throw new Error("类型错误: 只有数组支持成员赋值");
    }
    if (property === "length") {
      throw new Error("数组 length 为只读");
    }
    if (!Number.isInteger(property) || property < 0) {
      throw new Error("数组下标必须是非负整数");
    }
    if (property >= this.limits.maxArrayLength) {
      throw new Error("数组长度过大（最大 " + this.limits.maxArrayLength + " 项）");
    }
    object[property] = value;
    return value;
  }

  _readMemberValue(object, node) {
    const property = this._resolveMemberKey(node, object);
    if (Array.isArray(object)) {
      if (property === "length") {
        return object.length;
      }
      if (!Number.isInteger(property) || property < 0) {
        throw new Error("数组下标必须是非负整数");
      }
      return property < object.length ? object[property] : false;
    }
    throw new Error("类型错误: 当前只支持数组成员访问");
  }

  _resolveMemberKey(node, object) {
    if (!node.computed) {
      return node.property;
    }
    const key = this.eval(node.property);
    if (Array.isArray(object)) {
      if (typeof key !== "number" || !Number.isInteger(key)) {
        throw new Error("数组下标必须是整数");
      }
      return key;
    }
    return key;
  }

  _toBool(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") return value !== "";
    if (Array.isArray(value)) return value.length > 0;
    return !!value;
  }

  _isString(value) {
    return typeof value === "string";
  }

  _isNumber(value) {
    return typeof value === "number" && !isNaN(value);
  }

  _isFunction(value) {
    return value && typeof value === "object" && value.type === "user_function";
  }

  _evalBinary(node) {
    const op = node.operator;

    // 逻辑运算需要短路求值：先求值左侧，根据结果决定是否求值右侧
    if (op === "&&") {
      return this._toBool(this.eval(node.left)) && this._toBool(this.eval(node.right));
    }
    if (op === "||") {
      return this._toBool(this.eval(node.left)) || this._toBool(this.eval(node.right));
    }

    const left = this.eval(node.left);
    const right = this.eval(node.right);

    switch (op) {
      // ---- 算术运算 ----
      case "+": {
        // 如果任一操作数是字符串，执行字符串拼接
        if (this._isString(left) || this._isString(right)) {
          return this._ensureStringSize(String(left) + String(right), "+");
        }
        this._checkNumber(left, "+");
        this._checkNumber(right, "+");
        return left + right;
      }
      case "-":
        this._checkNumber(left, "-");
        this._checkNumber(right, "-");
        return left - right;
      case "*":
        this._checkNumber(left, "*");
        this._checkNumber(right, "*");
        return left * right;
      case "/":
        this._checkNumber(left, "/");
        this._checkNumber(right, "/");
        if (right === 0) throw new Error("除数不能为零");
        return left / right;
      case "//":
        this._checkNumber(left, "//");
        this._checkNumber(right, "//");
        if (right === 0) throw new Error("除数不能为零");
        return Math.floor(left / right);
      case "%":
        this._checkNumber(left, "%");
        this._checkNumber(right, "%");
        if (right === 0) throw new Error("取模运算右侧不能为零");
        return left % right;

      // ---- 比较运算 ----
      case ">":
        this._checkNumber(left, ">");
        this._checkNumber(right, ">");
        return left > right;
      case ">=":
        this._checkNumber(left, ">=");
        this._checkNumber(right, ">=");
        return left >= right;
      case "<":
        this._checkNumber(left, "<");
        this._checkNumber(right, "<");
        return left < right;
      case "<=":
        this._checkNumber(left, "<=");
        this._checkNumber(right, "<=");
        return left <= right;
      case "==": {
        if (this._isNumber(left) && this._isNumber(right)) return left === right;
        return this._deepEqual(left, right);
      }
      case "!=": {
        if (this._isNumber(left) && this._isNumber(right)) return left !== right;
        return !this._deepEqual(left, right);
      }

      default:
        throw new Error("内部错误: 未知的二元运算符 " + op);
    }
  }

  _evalUnary(node) {
    const value = this.eval(node.argument);
    switch (node.operator) {
      case "-":
        this._checkNumber(value, "-");
        return -value;
      case "!":
        return !this._toBool(value);
      default:
        throw new Error("内部错误: 未知的一元运算符 " + node.operator);
    }
  }

  _evalIf(node) {
    if (this._toBool(this.eval(node.test))) {
      return this.eval(node.consequent);
    }
    if (node.alternate) {
      return this.eval(node.alternate);
    }
    return false;
  }

  _evalConditional(node) {
    const test = this.eval(node.test);
    if (this._toBool(test)) {
      return this.eval(node.consequent);
    } else {
      return this.eval(node.alternate);
    }
  }

  _evalWhile(node) {
    let result = false;
    this.loopDepth++;
    try {
      while (this._toBool(this.eval(node.test))) {
        this.loopCount++;
        if (this.loopCount > this.limits.maxLoopIterations) {
          throw new Error("循环次数过多（最大 " + this.limits.maxLoopIterations + " 次）");
        }
        try {
          result = this.eval(node.body);
        } catch (e) {
          if (e instanceof BreakSignal) {
            break;
          }
          if (e instanceof ContinueSignal) {
            continue;
          }
          throw e;
        }
      }
    } finally {
      this.loopDepth--;
    }
    return result;
  }

  _evalFor(node) {
    let result = false;
    return this._withScope(() => {
      if (node.init) {
        result = this.eval(node.init);
      }
      this.loopDepth++;
      try {
        while (node.test ? this._toBool(this.eval(node.test)) : true) {
          this.loopCount++;
          if (this.loopCount > this.limits.maxLoopIterations) {
            throw new Error("循环次数过多（最大 " + this.limits.maxLoopIterations + " 次）");
          }
          try {
            result = this.eval(node.body);
          } catch (e) {
            if (e instanceof BreakSignal) {
              break;
            }
            if (e instanceof ContinueSignal) {
              if (node.update) {
                this.eval(node.update);
              }
              continue;
            }
            throw e;
          }
          if (node.update) {
            result = this.eval(node.update);
          }
        }
      } finally {
        this.loopDepth--;
      }
      return result;
    });
  }

  _evalCall(node) {
    const args = node.args.map(arg => this.eval(arg));

    if (node.callee) {
      return this._evalMemberCall(node.callee, args);
    }

    const name = node.name;
    const fn = this.builtins[name];
    if (fn) {
      return fn(args);
    }

    const userFn = this._readVariable(name);
    if (!this._isFunction(userFn)) {
      throw new Error("未定义的函数: " + name);
    }
    return this._invokeUserFunction(userFn, args);
  }

  _evalMemberCall(callee, args) {
    const object = this.eval(callee.object);
    const property = this._resolveMemberKey(callee, object);

    if (!Array.isArray(object)) {
      throw new Error("类型错误: 当前只支持数组方法调用");
    }

    switch (property) {
      case "push":
        if (args.length !== 1) {
          throw new Error("push 方法需要 1 个参数");
        }
        if (object.length >= this.limits.maxArrayLength) {
          throw new Error("数组长度过大（最大 " + this.limits.maxArrayLength + " 项）");
        }
        object.push(args[0]);
        return object.length;
      case "pop":
        if (args.length !== 0) {
          throw new Error("pop 方法不接受参数");
        }
        return object.length === 0 ? false : object.pop();
      default:
        throw new Error("未定义的数组方法: " + property);
    }
  }

  _deepEqual(left, right) {
    if (typeof left !== typeof right) return false;
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right)) return false;
      if (left.length !== right.length) return false;
      for (let i = 0; i < left.length; i++) {
        if (!this._deepEqual(left[i], right[i])) return false;
      }
      return true;
    }
    return left === right;
  }

  _tick() {
    this.stepCount++;
    if (this.stepCount > this.limits.maxExecutionSteps) {
      throw new Error("执行步数过多（最大 " + this.limits.maxExecutionSteps + " 步）");
    }
  }

  _evalSource(source) {
    if (typeof source !== "string") {
      throw new Error("eval 需要 1 个字符串参数");
    }
    const ast = parseAndValidateSource(source);
    return this.eval(ast);
  }

  _checkNumber(value, op) {
    if (!this._isNumber(value)) {
      throw new Error("类型错误: 运算符 " + op + " 需要数值类型");
    }
  }

  _invokeUserFunction(fnValue, args) {
    if (args.length !== fnValue.params.length) {
      throw new Error("函数 " + fnValue.name + " 参数数量错误: 期望 " + fnValue.params.length + " 个，实际为 " + args.length + " 个");
    }
    this.callDepth++;
    if (this.callDepth > this.limits.maxCallDepth) {
      this.callDepth--;
      throw new Error("函数调用层数过深（最大 " + this.limits.maxCallDepth + " 层）");
    }

    this.functionDepth++;
    try {
      return this._withScope(() => {
        for (let i = 0; i < fnValue.params.length; i++) {
          this._currentScope()[fnValue.params[i]] = args[i];
        }
        try {
          return this.eval(fnValue.body);
        } catch (e) {
          if (e instanceof ReturnSignal) {
            return e.value;
          }
          throw e;
        }
      });
    } finally {
      this.functionDepth--;
      this.callDepth--;
    }
  }

  _canUseImplicitSealFallback() {
    return this.functionDepth <= 0;
  }

  _ensureStringSize(value, op) {
    if (typeof value === "string" && value.length > this.limits.maxStringLength) {
      throw new Error("字符串结果过长（最大 " + this.limits.maxStringLength + " 字符，来源: " + op + "）");
    }
    return value;
  }

  _currentScope() {
    return this.scopes[this.scopes.length - 1];
  }

  _evalStatementList(statements) {
    let result = false;
    for (let i = 0; i < statements.length; i++) {
      result = this.eval(statements[i]);
    }
    return result;
  }

  _pushScope() {
    this.scopes.push(Object.create(null));
  }

  _popScope() {
    if (this.scopes.length <= 1) {
      throw new Error("内部错误: 不能弹出全局作用域");
    }
    this.scopes.pop();
  }

  _findScopeContaining(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (Object.prototype.hasOwnProperty.call(this.scopes[i], name)) {
        return this.scopes[i];
      }
    }
    return null;
  }

  _findScopedValue(name) {
    const scope = this._findScopeContaining(name);
    if (!scope) {
      return { found: false, value: undefined };
    }
    return { found: true, value: scope[name] };
  }

  _withScope(fn) {
    this._pushScope();
    try {
      return fn();
    } finally {
      this._popScope();
    }
  }
}

class BreakSignal extends Error {
  constructor() {
    super("break");
  }
}

class ContinueSignal extends Error {
  constructor() {
    super("continue");
  }
}

class ReturnSignal extends Error {
  constructor(value) {
    super("return");
    this.value = value;
  }
}

// ============================
// 第六部分: 内置函数
// ============================

/**
 * 创建内置函数表
 * @param {function} diceFn - 调用原生骰子的函数，签名为 (diceExpr: string) => number
 */
function createBuiltins(diceFn, variableApi) {
  return {
    // 掷骰: dice("1d20+5")
    dice(args) {
      if (args.length !== 1 || typeof args[0] !== "string") {
        throw new Error("dice 函数需要 1 个字符串参数，如 dice(\"1d20\")");
      }
      return diceFn(args[0]);
    },

    // 最大值: max(1, 2, 3)
    max(args) {
      if (args.length === 0) throw new Error("max 函数至少需要 1 个参数");
      args.forEach(a => { if (typeof a !== "number") throw new Error("max 函数的所有参数必须为数值"); });
      return Math.max.apply(null, args);
    },

    // 最小值: min(1, 2, 3)
    min(args) {
      if (args.length === 0) throw new Error("min 函数至少需要 1 个参数");
      args.forEach(a => { if (typeof a !== "number") throw new Error("min 函数的所有参数必须为数值"); });
      return Math.min.apply(null, args);
    },

    // 向下取整: floor(3.14) => 3
    floor(args) {
      if (args.length !== 1 || typeof args[0] !== "number") throw new Error("floor 函数需要 1 个数值参数");
      return Math.floor(args[0]);
    },

    // 向上取整: ceil(3.14) => 4
    ceil(args) {
      if (args.length !== 1 || typeof args[0] !== "number") throw new Error("ceil 函数需要 1 个数值参数");
      return Math.ceil(args[0]);
    },

    // 四舍五入: round(3.14) => 3
    round(args) {
      if (args.length !== 1 || typeof args[0] !== "number") throw new Error("round 函数需要 1 个数值参数");
      return Math.round(args[0]);
    },

    // 绝对值: abs(-5) => 5
    abs(args) {
      if (args.length !== 1 || typeof args[0] !== "number") throw new Error("abs 函数需要 1 个数值参数");
      return Math.abs(args[0]);
    },

    // 数字转字符串: str(15) => "15"
    str(args) {
      if (args.length !== 1 || typeof args[0] !== "number") throw new Error("str 函数需要 1 个数值参数");
      return variableApi.ensureStringSize(String(args[0]), "str");
    },

    len(args) {
      if (args.length !== 1) throw new Error("len 函数需要 1 个参数");
      if (typeof args[0] === "string" || Array.isArray(args[0])) return args[0].length;
      throw new Error("len 函数只支持字符串或数组");
    },

    substr(args) {
      if (args.length < 2 || args.length > 3) throw new Error("substr 函数需要 2 或 3 个参数");
      if (typeof args[0] !== "string") throw new Error("substr 函数的第 1 个参数必须为字符串");
      if (!Number.isInteger(args[1])) throw new Error("substr 函数的第 2 个参数必须为整数");
      if (args.length === 3 && !Number.isInteger(args[2])) throw new Error("substr 函数的第 3 个参数必须为整数");
      return variableApi.ensureStringSize(args[0].substr(args[1], args.length === 3 ? args[2] : undefined), "substr");
    },

    slice(args) {
      if (args.length < 2 || args.length > 3) throw new Error("slice 函数需要 2 或 3 个参数");
      if (typeof args[0] !== "string") throw new Error("slice 函数的第 1 个参数必须为字符串");
      if (!Number.isInteger(args[1])) throw new Error("slice 函数的第 2 个参数必须为整数");
      if (args.length === 3 && !Number.isInteger(args[2])) throw new Error("slice 函数的第 3 个参数必须为整数");
      return variableApi.ensureStringSize(args[0].slice(args[1], args.length === 3 ? args[2] : undefined), "slice");
    },

    indexOf(args) {
      if (args.length !== 2) throw new Error("indexOf 函数需要 2 个参数");
      if (typeof args[0] !== "string" || typeof args[1] !== "string") {
        throw new Error("indexOf 函数的参数必须都是字符串");
      }
      return args[0].indexOf(args[1]);
    },

    includes(args) {
      if (args.length !== 2) throw new Error("includes 函数需要 2 个参数");
      if (typeof args[0] !== "string" || typeof args[1] !== "string") {
        throw new Error("includes 函数的参数必须都是字符串");
      }
      return args[0].includes(args[1]);
    },

    startsWith(args) {
      if (args.length !== 2) throw new Error("startsWith 函数需要 2 个参数");
      if (typeof args[0] !== "string" || typeof args[1] !== "string") {
        throw new Error("startsWith 函数的参数必须都是字符串");
      }
      return args[0].startsWith(args[1]);
    },

    endsWith(args) {
      if (args.length !== 2) throw new Error("endsWith 函数需要 2 个参数");
      if (typeof args[0] !== "string" || typeof args[1] !== "string") {
        throw new Error("endsWith 函数的参数必须都是字符串");
      }
      return args[0].endsWith(args[1]);
    },

    split(args) {
      if (args.length !== 2) throw new Error("split 函数需要 2 个参数");
      if (typeof args[0] !== "string" || typeof args[1] !== "string") {
        throw new Error("split 函数的参数必须都是字符串");
      }
      const result = args[0].split(args[1]);
      if (result.length > 256) {
        throw new Error("split 结果过大（最大 256 项）");
      }
      for (let i = 0; i < result.length; i++) {
        variableApi.ensureStringSize(result[i], "split");
      }
      return result;
    },

    join(args) {
      if (args.length !== 2) throw new Error("join 函数需要 2 个参数");
      if (!Array.isArray(args[0])) throw new Error("join 函数的第 1 个参数必须为数组");
      if (typeof args[1] !== "string") throw new Error("join 函数的第 2 个参数必须为字符串");
      return variableApi.ensureStringSize(args[0].map(function (item) { return String(item); }).join(args[1]), "join");
    },

    upper(args) {
      if (args.length !== 1 || typeof args[0] !== "string") throw new Error("upper 函数需要 1 个字符串参数");
      return variableApi.ensureStringSize(args[0].toUpperCase(), "upper");
    },

    lower(args) {
      if (args.length !== 1 || typeof args[0] !== "string") throw new Error("lower 函数需要 1 个字符串参数");
      return variableApi.ensureStringSize(args[0].toLowerCase(), "lower");
    },

    trim(args) {
      if (args.length !== 1 || typeof args[0] !== "string") throw new Error("trim 函数需要 1 个字符串参数");
      return variableApi.ensureStringSize(args[0].trim(), "trim");
    },

    eval(args) {
      if (args.length !== 1 || typeof args[0] !== "string") {
        throw new Error("eval 函数需要 1 个字符串参数");
      }
      return variableApi.evalSource(args[0]);
    },

    // 显式读取变量: get("HP")
    get(args) {
      if (args.length !== 1 || typeof args[0] !== "string") {
        throw new Error("get 函数需要 1 个字符串参数，如 get(\"HP\")");
      }
      return variableApi.getExplicit(args[0]);
    },

    // 显式写入变量: set("HP", 10)
    set(args) {
      if (args.length !== 2) {
        throw new Error("set 函数需要 2 个参数，如 set(\"HP\", 10)");
      }
      if (typeof args[0] !== "string") {
        throw new Error("set 函数的第 1 个参数必须为字符串变量名");
      }
      return variableApi.setExplicit(args[0], args[1]);
    },

    // 随机选择: choose("a", "b", "c") → 自动掷 1d3 并返回对应字符串
    choose(args) {
      if (args.length === 0) throw new Error("choose 函数至少需要 1 个参数");
      args.forEach(function (a) {
        if (typeof a !== "string") throw new Error("choose 函数的所有参数必须为字符串");
      });
      const n = args.length;
      const rollResult = diceFn("1d" + n);
      const idx = rollResult - 1;
      if (idx < 0 || idx >= n) throw new Error("choose 掷骰结果超出范围");
      return args[idx];
    },

    // 带权重随机选择: wchoose("普通命中", 80, "暴击", 15, "大失败", 5)
    wchoose(args) {
      if (args.length < 4) throw new Error("wchoose 函数至少需要 2 组“字符串, 权重”参数");
      if (args.length % 2 !== 0) throw new Error("wchoose 函数的参数数量必须为偶数");

      let totalWeight = 0;
      const entries = [];

      for (let i = 0; i < args.length; i += 2) {
        const text = args[i];
        const weight = args[i + 1];

        if (typeof text !== "string") {
          throw new Error("wchoose 函数的奇数位参数必须为字符串");
        }
        if (!Number.isInteger(weight) || weight <= 0) {
          throw new Error("wchoose 函数的偶数位参数必须为正整数权重");
        }

        totalWeight += weight;
        entries.push({ text, weight });
      }

      const rollResult = diceFn("1d" + totalWeight);
      if (!Number.isInteger(rollResult) || rollResult < 1 || rollResult > totalWeight) {
        throw new Error("wchoose 掷骰结果超出范围");
      }

      let cumulative = 0;
      for (let i = 0; i < entries.length; i++) {
        cumulative += entries[i].weight;
        if (rollResult <= cumulative) {
          return entries[i].text;
        }
      }

      throw new Error("wchoose 未能命中任何选项");
    },
  };
}

// ============================
// 第七部分: 中文标点归一化
// ============================
const PUNCTUATION_MAP = {
  "（": "(",
  "）": ")",
  "【": "[",
  "】": "]",
  "「": "{",
  "」": "}",
  "｛": "{",
  "｝": "}",
  "［": "[",
  "］": "]",
  "，": ",",
  "、": ",",
  "。": ".",
  "；": ";",
  "：": ":",
  "？": "?",
  "！": "!",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "＋": "+",
  "－": "-",
  "＊": "*",
  "／": "/",
  "％": "%",
  "＞": ">",
  "＜": "<",
  "＝": "=",
  "＆": "&",
  "｜": "|",
  "．": ".",
  "～": "~",
  "　": " ",
};

const READONLY_SEAL_VARIABLES = new Set([
  "$t玩家",
  "$t玩家_RAW",
  "$tQQ昵称",
  "$t账号ID",
  "$t账号ID_RAW",
  "$tQQ",
  "$t群名",
  "$t群号",
  "$t群号_RAW",
  "$t群组骰子面数",
  "$t个人骰子面数",
  "$t骰子账号",
  "$t骰子昵称",
  "$tDate",
  "$tYear",
  "$tMonth",
  "$tDay",
  "$tWeekday",
  "$tHour",
  "$tMinute",
  "$tSecond",
  "$tTimestamp",
  "$t文本长度",
  "$t平台",
  "$t游戏模式",
  "$t消息类型",
  "$t当前记录",
  "$t权限等级",
  "$tMsgID",
  "$t日志开启",
  "娱乐:今日人品",
  "常量:APPNAME",
  "常量:VERSION",
]);

function normalizePunctuation(source) {
  let result = "";
  let inString = false;
  let stringMode = "single";
  let escape = false;
  let stringEndChar = '"';

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const three = source.slice(i, i + 3);

    if (inString) {
      if (stringMode === "triple") {
        if (three === '"""') {
          result += '"""';
          i += 2;
          inString = false;
          stringMode = "single";
          stringEndChar = '"';
          continue;
        }
        result += ch;
        continue;
      } else {
        if (escape) {
          result += ch;
          escape = false;
          continue;
        }
        if (ch === "\\") {
          result += ch;
          escape = true;
          continue;
        }
        if (ch === stringEndChar) {
          result += '"';
          inString = false;
          stringEndChar = '"';
          continue;
        }
        result += ch;
        continue;
      }
    }

    if (three === '"""') {
      result += '"""';
      i += 2;
      inString = true;
      stringMode = "triple";
      stringEndChar = '"';
      continue;
    }
    if (ch === '"') {
      result += ch;
      inString = true;
      stringMode = "single";
      stringEndChar = '"';
      continue;
    }
    if (ch === "“" || ch === "”") {
      result += '"';
      inString = true;
      stringMode = "single";
      stringEndChar = "”";
      continue;
    }

    result += Object.prototype.hasOwnProperty.call(PUNCTUATION_MAP, ch) ? PUNCTUATION_MAP[ch] : ch;
  }

  return result;
}

// ============================
// 第九部分: 模板格式化
// ============================
function formatTemplate(template, expr, user, result) {
  // 转义序列 → 临时占位符
  template = template.replace(/\\\\/g, "\x00");
  template = template.replace(/\\\{/g, "\x01");
  template = template.replace(/\{expr\}/g, "\x02");
  template = template.replace(/\{user\}/g, "\x03");
  template = template.replace(/\{result\}/g, "\x04");
  // 替换占位符
  template = template.replace(/\x02/g, expr);
  template = template.replace(/\x03/g, user);
  template = template.replace(/\x04/g, String(result));
  // 恢复转义字符
  template = template.replace(/\x00/g, "\\");
  template = template.replace(/\x01/g, "{");
  return template;
}

// ============================
// 第十部分: 求值入口
// ============================
const MAX_EXPR_LENGTH = 512;
const MAX_AST_DEPTH = 256;
const MAX_STATEMENTS = 64;
const MAX_VARIABLES = 64;
const MAX_EXECUTION_STEPS = 10000;
const MAX_LOOP_ITERATIONS = 1000;
const MAX_ARRAY_LENGTH = 256;
const MAX_CALL_DEPTH = 64;
const MAX_FUNCTION_PARAMS = 16;
const MAX_STRING_LENGTH = 4096;
const DEFAULT_OUTPUT_TEMPLATE = "由于\n```\n{expr}\n```\n{user} 得到了结果\n{result}";

function evaluate(source, diceFn, ctx) {
  const ast = parseAndValidateSource(source);
  const builtins = createBuiltins(diceFn, null);
  const interpreter = new Interpreter(builtins, MAX_VARIABLES, ctx, {
    maxExecutionSteps: MAX_EXECUTION_STEPS,
    maxLoopIterations: MAX_LOOP_ITERATIONS,
    maxArrayLength: MAX_ARRAY_LENGTH,
    maxCallDepth: MAX_CALL_DEPTH,
    maxFunctionParams: MAX_FUNCTION_PARAMS,
    maxStringLength: MAX_STRING_LENGTH,
  });
  interpreter.builtins = createBuiltins(diceFn, {
    getExplicit(name) {
      return interpreter._readVariableWithPolicy(name, true);
    },
    setExplicit(name, value) {
      return interpreter._writeVariableWithPolicy(name, value, true);
    },
    ensureStringSize(value, op) {
      return interpreter._ensureStringSize(value, op);
    },
    evalSource(source) {
      return interpreter._evalSource(source);
    },
  });
  return interpreter.eval(ast);
}

function parseAndValidateSource(source) {
  source = normalizePunctuation(source);
  if (source.length > MAX_EXPR_LENGTH) {
    throw new Error("表达式过长（最大 " + MAX_EXPR_LENGTH + " 字符）");
  }
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  if (ast.type === ASTType.PROGRAM && ast.statements.length > MAX_STATEMENTS) {
    throw new Error("语句数量过多（最大 " + MAX_STATEMENTS + " 条）");
  }
  if (getAstDepth(ast) > MAX_AST_DEPTH) {
    throw new Error("表达式嵌套过深（最大 " + MAX_AST_DEPTH + " 层）");
  }
  return ast;
}

function getAstDepth(root) {
  let maxDepth = 0;
  const stack = [{ node: root, depth: 1 }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !current.node) continue;
    if (current.depth > maxDepth) {
      maxDepth = current.depth;
    }

    switch (current.node.type) {
      case ASTType.PROGRAM:
        for (let i = 0; i < current.node.statements.length; i++) {
          stack.push({ node: current.node.statements[i], depth: current.depth + 1 });
        }
        break;
      case ASTType.BLOCK_STMT:
        for (let i = 0; i < current.node.statements.length; i++) {
          stack.push({ node: current.node.statements[i], depth: current.depth + 1 });
        }
        break;
      case ASTType.AUTO_DECL:
        stack.push({ node: current.node.initializer, depth: current.depth + 1 });
        break;
      case ASTType.EXPR_STMT:
        stack.push({ node: current.node.expression, depth: current.depth + 1 });
        break;
      case ASTType.IF_STMT:
        stack.push({ node: current.node.test, depth: current.depth + 1 });
        stack.push({ node: current.node.consequent, depth: current.depth + 1 });
        if (current.node.alternate) {
          stack.push({ node: current.node.alternate, depth: current.depth + 1 });
        }
        break;
      case ASTType.WHILE_STMT:
        stack.push({ node: current.node.test, depth: current.depth + 1 });
        stack.push({ node: current.node.body, depth: current.depth + 1 });
        break;
      case ASTType.FOR_STMT:
        if (current.node.init) {
          stack.push({ node: current.node.init, depth: current.depth + 1 });
        }
        if (current.node.test) {
          stack.push({ node: current.node.test, depth: current.depth + 1 });
        }
        if (current.node.update) {
          stack.push({ node: current.node.update, depth: current.depth + 1 });
        }
        stack.push({ node: current.node.body, depth: current.depth + 1 });
        break;
      case ASTType.FUNCTION_DECL:
        stack.push({ node: current.node.body, depth: current.depth + 1 });
        break;
      case ASTType.RETURN_STMT:
        if (current.node.argument) {
          stack.push({ node: current.node.argument, depth: current.depth + 1 });
        }
        break;
      case ASTType.ASSIGN_EXPR:
        stack.push({ node: current.node.target, depth: current.depth + 1 });
        stack.push({ node: current.node.value, depth: current.depth + 1 });
        break;
      case ASTType.ARRAY_LITERAL:
        for (let i = 0; i < current.node.elements.length; i++) {
          stack.push({ node: current.node.elements[i], depth: current.depth + 1 });
        }
        break;
      case ASTType.MEMBER_EXPR:
        stack.push({ node: current.node.object, depth: current.depth + 1 });
        if (current.node.computed) {
          stack.push({ node: current.node.property, depth: current.depth + 1 });
        }
        break;
      case ASTType.BINARY_EXPR:
        stack.push({ node: current.node.left, depth: current.depth + 1 });
        stack.push({ node: current.node.right, depth: current.depth + 1 });
        break;
      case ASTType.UNARY_EXPR:
        stack.push({ node: current.node.argument, depth: current.depth + 1 });
        break;
      case ASTType.CONDITIONAL_EXPR:
        stack.push({ node: current.node.test, depth: current.depth + 1 });
        stack.push({ node: current.node.consequent, depth: current.depth + 1 });
        stack.push({ node: current.node.alternate, depth: current.depth + 1 });
        break;
      case ASTType.CALL_EXPR:
        for (let i = 0; i < current.node.args.length; i++) {
          stack.push({ node: current.node.args[i], depth: current.depth + 1 });
        }
        break;
    }
  }

  return maxDepth;
}

// ============================
// 第十一部分: SealDice 插件注册
// ============================
function main() {
  // 检查全局 seal 对象是否存在
  if (typeof seal === "undefined") {
    return;
  }

  // 创建或获取扩展（完全遵循官方示例 004 模式）
  let ext = seal.ext.find("complex-dice-v2-dev");
  if (!ext) {
    ext = seal.ext.new("complex-dice-v2-dev", "shimakaze", "1.5.0-dev");
  }

  // 创建 .cd 命令（在 if 块外部，确保即使扩展已存在也能注册命令）
  let cmdCd = seal.ext.newCmdItemInfo();
  cmdCd.name = "cd";
  cmdCd.help = "复杂骰子表达式求值\n" +
               "用法: .cd <表达式>\n" +
               "实验支持: true/false if/else while for break continue function return 数组 [] push pop length eval #注释 三引号多行字符串\n" +
               "作用域: block 建作用域, 数组按引用传参, 函数内默认不隐式访问海豹变量\n" +
               "变量规则: $g* 仅权限等级>=50可写; 指定海豹内置变量只读\n" +
               "字符串: \"...\" 为单行, \"\"\"...\"\"\" 为多行\n" +
               "安全限制: 执行步数/循环次数/数组长度/字符串长度/调用深度/函数参数数量均有限制\n" +
               "示例: .cd function fib(n) { if (n <= 1) { return n } return fib(n - 1) + fib(n - 2) }\nfib(6)\n" +
               "示例: .cd { auto a = [1, 2]; a.push(3); a.length }\n" +
               "示例: .cd \"\"\"第一行\n第二行\"\"\"\n" +
               "示例: .cd set(\"$g测试方法\", \"function fib(n) {\\n  if (n <= 1) {\\n    return n\\n  }\\n  return fib(n - 1) + fib(n - 2)\\n}\\nfib(6)\")\n" +
               "示例: .cd eval(get(\"$g测试方法\"))";
  cmdCd.allowDelegate = true;
  cmdCd.disabledInPrivate = false;

  cmdCd.solve = function (ctx, msg, cmdArgs) {
    try {
      const activeCtx = cmdCd.allowDelegate ? seal.getCtxProxyFirst(ctx, cmdArgs) : ctx;
      let exprText = cmdArgs.rawArgs ? cmdArgs.rawArgs.trim() : "";

      if (!exprText) {
        seal.replyToSender(ctx, msg, "用法: .cd <表达式>\n示例: .cd dice(\"1d20\") + 5");
        return seal.ext.newCmdExecuteResult(true);
      }

      const diceFn = function (diceExpr) {
        let formatted;
        try {
          formatted = seal.format(activeCtx, "{" + diceExpr + "}");
          console.log("[complex-dice] seal.format raw output:", diceExpr, JSON.stringify(formatted));
        } catch (e) {
          throw new Error("掷骰表达式格式错误: " + diceExpr);
        }
        if (isFormatErrorText(formatted)) {
          throw new Error("掷骰表达式格式错误: " + diceExpr);
        }
        const num = extractResultNumber(formatted);
        if (num === null) {
          throw new Error("无法从掷骰结果中提取数值: " + formatted);
        }
        return num;
      };

      const result = evaluate(exprText, diceFn, activeCtx);
      // 获取用户名
      let userName = "";
      if (activeCtx && activeCtx.player && activeCtx.player.name) {
        userName = activeCtx.player.name;
      } else if (msg && msg.sender && msg.sender.nickname) {
        userName = msg.sender.nickname;
      }
      seal.replyToSender(ctx, msg, formatTemplate(DEFAULT_OUTPUT_TEMPLATE, exprText, userName, result));
      return seal.ext.newCmdExecuteResult(true);

    } catch (e) {
      seal.replyToSender(ctx, msg, e.message || "表达式错误");
      return seal.ext.newCmdExecuteResult(false);
    }
  };

  // 将命令注册到扩展中
  ext.cmdMap["cd"] = cmdCd;
  seal.ext.register(ext);
}

/**
 * 从 seal.format 的返回文本中提取最终数值结果
 *
 * seal.format(ctx, "{1d20}") 返回值可能是:
 *   "1d20=15"                    → 提取 15
 *   "2d6+1=[1+3]+1=5"           → 提取最后一个等号后的 5
 *   "3d6=(2+1+5)=8"             → 提取 8
 *   "1d100=42[奖励成功]"          → 提取 42
 */
function extractResultNumber(formatted) {
  if (!formatted) return null;

  // 尝试多种策略提取数值

  // 策略1: 查找最后一个 = 后的纯数字或带符号的数字
  const lastEqIdx = formatted.lastIndexOf("=");
  if (lastEqIdx >= 0) {
    const afterEq = formatted.slice(lastEqIdx + 1).trim();
    // 尝试在开头匹配一个数字（可能带负号）
    const match = afterEq.match(/^(-?\d+(?:\.\d+)?)/);
    if (match) {
      return Number(match[1]);
    }
  }

  // 策略2: 如果整个结果就是个数字
  const trimmed = formatted.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return null;
}

function isFormatErrorText(formatted) {
  if (typeof formatted !== "string") return false;
  const trimmed = formatted.trim();
  return /^格式化错误(?:V\d+)?:/u.test(trimmed);
}

// ============================
// 启动
// ============================
try {
  main();
} catch (e) {
  console.error("[complex-dice] 插件初始化失败: " + (e && e.message ? e.message : e));
}

})();
