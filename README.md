# 八十九分最亏

绩点按分档换算时，89 和 90 可能差一整档。填这学期每门课的学分和预计分、之前的已修学分和平均绩点，看哪门课只差一两分就跨档、多考 1 分哪门最值、想到目标累计绩点最少还要多考几分。

- 在线体验：https://xululu0401.github.io/eighty-nine/
- 纯前端，`index.html` + `core.js`（计算）+ `ui.js`（界面），不联网、输入只存在本机浏览器。
- 测试：`node --test tests/core.test.cjs`；`tests/ref.py` 是独立的 Python 参考实现（Fraction 精确计算、逐整数分枚举），生成 `tests/ref.json` 对拍。
- 预置换算只是常见形式，不代表任何具体学校；默认数字为虚构示例。
