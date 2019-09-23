# MeiZiTu-Crawler

自动爬取 [妹子图](https://www.mzitu.com) 的全量图片

# How To Use

```bash
$ npm install
$ node index
```

# Man Pages

```bash
node index

  --start, -s <number> [开始爬取的页码, 最小为 1]
  --end, -e <number> [爬取的最后一页页码， 目前最大为 231]
  --connections, -c <number> 并发的连接数，默认值：12，100M 带宽下推荐 100
  --proxy 启动代理，在 index.js 中可以修改 crawlerOptions.proxy 代理地址，默认 http://localhost:8118，除非 mzitu.com 被屏蔽，否则直连效果最佳
  --simplelog 关闭单屏日志，启动简单滚动日志

```

example: `node index -s 1 -e 100 -c 100`

# Where is my trophies

爬取的图片默认在 `./pic` 下，可以修改 picDir 存放到别处
