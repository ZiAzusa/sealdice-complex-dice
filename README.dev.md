# complex-dice.dev

`complex-dice.dev.js` 是实验版解释器。

它在正式版 `complex-dice.js` 的基础上，额外提供脚本级控制流、用户函数、数组和更强的类型能力，用于验证更完整的语言模型是否适合后续并入正式版。

## 与正式版的区别

- 正式版偏向“安全、轻量的表达式求值器”
- 实验版偏向“受限脚本解释器”
- 实验版功能更多，但也引入了更多语义和资源限制
- 正式版和实验版的命令实现互相独立，实验版扩展名为 `complex-dice-v2-dev`

## 用法

```text
.cd <表达式或脚本>
```

支持多语句，支持换行和 `;` 分隔。

## 已支持的能力

### 基础值类型

- 数字
- 字符串
- 布尔值：`true`、`false`
- 数组

### 变量

- `auto` 局部变量
- Unicode 变量名
- 普通赋值
- `get("变量名")` / `set("变量名", 值)` 显式访问海豹变量

变量解析规则：

1. 先查局部作用域链
2. 如果当前不在函数内，则允许隐式查海豹变量
3. 海豹变量查找顺序仍是：原名 -> 自动补 `$`

注意：

- 函数内部默认不会隐式读取或写入海豹变量
- 如果函数内部需要访问海豹变量，必须显式使用 `get()` / `set()`

### 控制流

- `if / else`
- `while`
- `for (init; condition; update)`
- `break`
- `continue`
- 三元表达式 `? :`

限制：

- `break` / `continue` 只能在循环内使用
- `if / while / for / block` 既可以当语句，也可以作为可求值结构放进表达式里
- 这些结构作为表达式时，结果为其最后一个已执行语句的值

### 函数

- `function 名称(参数...) { ... }`
- `return`
- 用户函数调用
- 递归

限制：

- `return` 只能在函数内使用
- 函数有调用深度限制
- 函数参数数量有限制

### 数组

- 数组字面量：`[]`
- 下标访问：`a[0]`
- 下标写入：`a[0] = 3`
- `a.length`
- `a.push(x)`
- `a.pop()`

数组语义：

- 数组按引用传参
- 函数内修改数组会影响外部同一个数组对象
- `length` 是只读的

### 字符串相关内置函数

- `str(x)`
- `len(x)`
- `substr(str, start[, len])`
- `slice(str, start[, end])`
- `indexOf(str, sub)`
- `includes(str, sub)`
- `startsWith(str, prefix)`
- `endsWith(str, suffix)`
- `split(str, sep)`
- `join(arr, sep)`
- `upper(str)`
- `lower(str)`
- `trim(str)`

### 其他内置函数

- `dice(expr)`
- `max(...)`
- `min(...)`
- `floor(x)`
- `ceil(x)`
- `round(x)`
- `abs(x)`
- `choose(...)`
- `wchoose(...)`

## 作用域语义

实验版当前采用 block 作用域：

- 顶层脚本有全局作用域
- 每个 `{ ... }` block 都会新建一个作用域
- `for (...) { ... }` 的初始化和循环体在同一个额外作用域中执行
- 函数调用会新建函数作用域
- 大括号内部支持纯换行分句，不要求额外写分号

示例：

```text
.cd {
  auto x = 1
}
x
```

上面的 `x` 在 block 外不可见。

## 资源与安全限制

实验版不是无限制脚本环境。当前内置硬限制如下：

- 表达式长度：`512`
- AST 深度：`256`
- 语句数量：`64`
- 单作用域局部变量数量：`64`
- 执行步数：`10000`
- 循环总次数：`1000`
- 数组长度：`256`
- 函数调用深度：`64`
- 单个函数参数数量：`16`
- 字符串长度：`4096`

这些限制的目的：

- 防止死循环
- 防止递归爆炸
- 防止超大数组
- 防止超长字符串引发过大 GC 和内存压力

## 示例

### if / else

```text
.cd if (true) { "yes" } else { "no" }
```

也可以作为表达式继续参与运算：

```text
.cd (if (true) { 1 } else { 0 }) + 2
```

### while

```text
.cd auto i = 0
while (i < 3) {
  i = i + 1
}
i
```

### for

```text
.cd auto sum = 0
for (auto i = 0; i < 5; i = i + 1) {
  sum = sum + i
}
sum
```

### 函数与递归

```text
.cd function fib(n) {
  if (n <= 1) {
    return n
  }
  return fib(n - 1) + fib(n - 2)
}
fib(6)
```

### block 作用域

```text
.cd {
  auto msg = "inside"
  msg
}
```

block 也可以作为表达式使用：

```text
.cd ({ auto x = 1; x + 2 }) * 3
```

### 数组引用传参

```text
.cd function pushOne(arr) {
  arr.push(1)
  return arr.length
}
auto a = []
pushOne(a)
a.length
```

### 显式海豹变量访问

```text
.cd function heal(x) {
  return set("HP", get("HP") + x)
}
heal(5)
```

## 当前已知语义选择

- block 建作用域
- 数组按引用传参
- 函数内部禁用隐式海豹变量 fallback
- 显式 `get/set` 仍然允许海豹变量 fallback

## 适合下一步验证的重点

- block 作用域是否符合你的预期
- 递归深度限制是否够用
- 数组按引用传参是否方便
- 字符串长度限制是否需要再调
- 是否要把部分实验能力拆成可配置开关
