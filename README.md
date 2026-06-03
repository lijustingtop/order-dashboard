# 订单数据预览

Vue 版订单数据看板，支持读取项目指定目录中的 CSV，也支持从网页上传新的订单 CSV。

## 启动

```bash
npm install --cache ./.npm-cache
npm start
```

打开浏览器访问：

```text
http://localhost:5173
```

## 数据目录

- 订单 CSV 默认目录：`data/orders`
- 库存 CSV 默认目录：`data/inventory`

网页上传的订单 CSV 会保存到 `data/orders`，刷新后仍可从“项目文件夹”区域选择读取。

也可以通过环境变量指定其他文件夹：

```bash
ORDER_DATA_DIR=/path/to/orders INVENTORY_DATA_DIR=/path/to/inventory npm start
```

## GitHub 上传

本项目已经初始化为 Git 仓库。完成 GitHub 登录后，可以添加远程仓库并推送：

```bash
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```
