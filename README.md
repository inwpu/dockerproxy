#  dockerproxy

> 基于 Cloudflare Workers 的 Docker Hub 镜像加速代理服务

[![Cloudflare Worker](https://img.shields.io/badge/Cloudflare-Worker-orange?logo=cloudflare)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/github/license/inwpu/dockerproxy)](./LICENSE)

---

##  项目简介

`dockerproxy` 是一个部署在 [Cloudflare Workers](https://developers.cloudflare.com/workers/) 上的轻量级 Docker Hub 代理服务，支持转发拉取请求、Token 授权、Blob 重定向等功能，可用于替代默认的 `registry-1.docker.io` 镜像地址，解决国内访问速度慢、连接不稳定等问题。

---

## 已部署地址：  
> https://hub.hxorz.cn/

## 使用说明

可直接用于 Docker 客户端的拉取命令：

```bash
(base) hx@orz:~$ sudo docker pull hub.hxorz.cn/verilator/verilator
Using default tag: latest
latest: Pulling from verilator/verilator
b71466b94f26: Pull complete 
27d124b1681b: Pull complete 
4f4fb700ef54: Pull complete 
9417454e0e36: Pull complete 
7c733edd3fa4: Pull complete 
e8a25f683f51: Pull complete 
Digest: sha256:0ea5e558e6b99051458d92fb409051eaa46993861ec3a7a30ca580516c4838f2
Status: Downloaded newer image for hub.hxorz.cn/verilator/verilator:latest
hub.hxorz.cn/verilator/verilator:latest
(base) hx@orz:~$ sudo docker pull hub.hxorz.cn/klee/klee
Using default tag: latest
latest: Pulling from klee/klee
677076032cca: Pull complete 
f93ea967c86a: Pull complete 
f88ab0029a96: Pull complete 
f383dbd111f8: Pull complete 
fc0648276376: Pull complete 
599db19d3e9a: Pull complete 
385f9b503343: Pull complete 
a90a52ed2d62: Pull complete 
2b2d83bfd086: Pull complete 
3073480fe468: Pull complete 
bb62eb57a2cb: Pull complete 
4f4fb700ef54: Pull complete 
f71fa94b0601: Pull complete 
03335a21adc6: Pull complete 
a2a3841cf5d6: Pull complete 
f11b1347b85e: Pull complete 
Digest: sha256:a21eaae5870cad1e8e22fd6a82c384a6f0a09cc57d84ab4b3fe89a55ea684f45
Status: Downloaded newer image for hub.hxorz.cn/klee/klee:latest
hub.hxorz.cn/klee/klee:latest
(base) hx@orz:~$ sudo docker images
[sudo] password for hx: 
REPOSITORY                              TAG       IMAGE ID       CREATED         SIZE
hub.hxorz.cn/verilator/verilator        latest    c273f7f29117   3 days ago      578MB
hxorz.cn/cr/dockerhub/dockurr/windows   latest    df07df026e7d   4 months ago    393MB
hub.hxorz.cn/klee/klee                  latest    cc49b2cfae90   18 months ago
```

<img width="1197" height="990" alt="image" src="https://github.com/user-attachments/assets/c1177594-a2a8-43ff-b762-858701f3f7ef" />

## docker daemon.json配置

在 `/etc/docker/daemon.json` 添加：

```
{
  "registry-mirrors": ["https://hub.hxorz.cn"]
}
```
然后重启 Docker 服务：

```
sudo systemctl restart docker
```

成功后拉取镜像：
```
(base) hx@orz:/etc/docker$ sudo docker pull dockurr/windows
Using default tag: latest
latest: Pulling from dockurr/windows
649717aac3d0: Pull complete 
d3b0db4c1afe: Pull complete 
ef5f211c6299: Pull complete 
8972b239f410: Pull complete 
0563f8f178d3: Pull complete 
37876d7217d8: Pull complete 
Digest: sha256:fe953a6a2f4686a9f0a540d9f9ad42b57ddad83af2050e91a0a8b1a6828bc8f5
Status: Downloaded newer image for dockurr/windows:latest
docker.io/dockurr/windows:latest
(base) hx@orz:/etc/docker$ sudo docker pull verilator/verilator
Using default tag: latest
latest: Pulling from verilator/verilator
b71466b94f26: Pull complete 
27d124b1681b: Pull complete 
4f4fb700ef54: Pull complete 
9417454e0e36: Pull complete 
7c733edd3fa4: Pull complete 
e8a25f683f51: Pull complete 
Digest: sha256:0ea5e558e6b99051458d92fb409051eaa46993861ec3a7a30ca580516c4838f2
Status: Downloaded newer image for verilator/verilator:latest
docker.io/verilator/verilator:latest
(base) hx@orz:/etc/docker$ sudo docker images
REPOSITORY            TAG       IMAGE ID       CREATED         SIZE
verilator/verilator   latest    c273f7f29117   3 days ago      578MB
dockurr/windows       latest    df07df026e7d   4 months ago    393MB
busybox               latest    0ed463b26dae   11 months ago   4.43MB
(base) hx@orz:/etc/docker$ cat daemon.json 
{
  "registry-mirrors": ["https://hub.hxorz.cn"]
}
```
<img width="1780" height="1049" alt="image" src="https://github.com/user-attachments/assets/5300098b-43e5-40f0-b487-5750401e062c" />

## 功能特性

 自动代理 /v2/ 目录结构与 registry 请求

 自动补全 library/ 命名空间（如 busybox → library/busybox）

 支持 /v2/auth token 获取代理

 支持私有仓库镜像授权（Authorization 头透传）

 支持 307 Blob 跳转并自动拉取二次资源

 支持 CORS 请求（可跨域使用）

 仅允许访问 registry-1.docker.io，防止 SSRF


 ## 项目维护者

作者：hxorz / inwpu

GitHub 项目地址：https://github.com/inwpu/dockerproxy

云端部署地址：https://hub.hxorz.cn

欢迎提交 PR、Issue，或用于你的自定义私有云镜像加速！
