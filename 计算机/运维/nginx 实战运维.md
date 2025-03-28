# root和alias的区别

重点在于在location块时如何对后续uri进行解释
比如如下配置:
```plain

location /preview/ {

root D:/nginx/html/bimwin-preview;

# add_header Access-Control-Allow-Origin *;
index index.html index.htm;
autoindex on;
}

```


uri: [http://localhost/preview/a](http://localhost/preview/a) 会被导向真实地址 D:/nginx/html/bimwin-preview/preview/a


```plain

location /preview/ {

  

alias D:/nginx/html/bimwin-preview;

  

# add_header Access-Control-Allow-Origin *;

  

index index.html index.htm;

  

autoindex on;

  

}

```


uri: [http://localhost/preview/a](http://localhost/preview/a) 会被导向真实地址 D:/nginx/html/bimwin-preview/a

# 关于在docker容器中执行nginx命令

  

> docker exec -it my_container /bin/sh


**my_container**为容器name

# 路径末尾不加斜杠导致的重定向


> [参考网址: CSDN](https://blog.csdn.net/yk10010/article/details/109586879)


当访问如下地址时:

[https://sdri.jtsj.com.cn:18069/bim](https://sdri.jtsj.com.cn:18069/bim), nginx会尝试在末尾添加斜杠. 其实就是开启一个301的重定向， 但是当nginx监听的端口和对外的端口不一致的时候会导致出错。

nginx加完斜杠后，访问地址变成了如下:
[https://sdri.jtsj.com.cn:8069/bim/](https://sdri.jtsj.com.cn:8069/bim/)


8069端口是内网本地端口，而18069才是公网端口，所以导致网页加载失败。

解决办法:

新版本nginx（≥1.11.8）可以通过设置 absolute_redirect off; 来解决

```plain

server {

listen 8080;

server_name www.mydomain.com;

absolute_redirect off; #取消绝对路径的重定向

root html;

...

}

```

# nginx代理路径问题


> [参考资料: 简书](https://www.jianshu.com/p/c751250a5112)


简单的说，不带URI的方式只替换主机名，带URI的方式替换整个URL。

实际例子:


```plain

server {

listen 80;

server_name localhost;

  

location /api1/ {

proxy_pass http://localhost:8080;

}

# http://localhost/api1/xxx -> http://localhost:8080/api1/xxx

  
  

location /api2/ {

proxy_pass http://localhost:8080/;

}

# http://localhost/api2/xxx -> http://localhost:8080/xxx

  
  

location /api3 {

proxy_pass http://localhost:8080;

}

# http://localhost/api3/xxx -> http://localhost:8080/api3/xxx

  
  

location /api4 {

proxy_pass http://localhost:8080/;

}

# http://localhost/api4/xxx -> http://localhost:8080//xxx，请注意这里的双斜线，好好分析一下。

  
  

location /api5/ {

proxy_pass http://localhost:8080/haha;

}

# http://localhost/api5/xxx -> http://localhost:8080/hahaxxx，请注意这里的haha和xxx之间没有斜杠，分析一下原因。

  

location /api6/ {

proxy_pass http://localhost:8080/haha/;

}

# http://localhost/api6/xxx -> http://localhost:8080/haha/xxx

  

location /api7 {

proxy_pass http://localhost:8080/haha;

}

# http://localhost/api7/xxx -> http://localhost:8080/haha/xxx

  

location /api8 {

proxy_pass http://localhost:8080/haha/;

}

# http://localhost/api8/xxx -> http://localhost:8080/haha//xxx，请注意这里的双斜杠。

}

```

  
  
  

# vue等history路由配置

  
  

```plain

try_files $uri $uri/ $uri/index.html;

```

  
  
  

# nginx限制文件上传配置

  
  

client_max_body_size 1024M; 上传文件大小限制

  
  
  

sendfile on; 设置为on表示启动高效传输文件的模式

  
  
  

keepalive_timeout 1800;保持连接的时间，默认65s

  
  
  

# gzip压缩和cache缓存配置

  
  

```plain

http {

##缓存cache参数配置##

proxy_connect_timeout 5;

proxy_read_timeout 60;

proxy_send_timeout 5;

proxy_buffer_size 16k;

proxy_buffers 4 64k;

proxy_busy_buffers_size 128k;

proxy_temp_file_write_size 128k;

#缓存到nginx的本地目录

proxy_temp_path C:/Users/chendm/Downloads/nginx-1.18.0/temp;

proxy_cache_path C:/Users/chendm/Downloads/nginx-1.18.0/temp/cache_temp levels=1:2 keys_zone=cache_one:200m inactive=1d max_size=30g;

  

gzip on; #打开gzip压缩功能

gzip_min_length 1k; #压缩阈值

gzip_buffers 4 16k; #buffer 不用修改

gzip_comp_level 2; #压缩级别:1-10，数字越大压缩的越好，时间也越长

gzip_types text/plain application/x-javascript text/css application/xml text/javascript application/x-httpd-php image/jpeg image/gif image/png; # 压缩文件类型

gzip_vary off; #跟Squid等缓存服务有关，on的话会在Header里增加 "Vary: Accept-Encoding"

gzip_disable "MSIE [1-6]\."; #IE1-6版本不支持gzip压缩

server {

# 是必须的， 否则缓存的location找不到静态资源路径

root C:/publish-server;

location / {

root C:/publish-server;

index index.html index.htm;

autoindex on;

# cache_one 名称是前面http部分keys_zone定的

proxy_cache cache_one;

proxy_cache_valid 168h;

# 忽略浏览器的头信息（ 除非浏览器开F12加no-cache ）

proxy_ignore_headers Set-Cookie Cache-Control;

proxy_hide_header Cache-Control;

proxy_hide_header Set-Cookie;

# 文件上传限制的大小

client_max_body_size 2000m;

}

# 前面必须有root否则，nginx找不到资源路径会404

location ~ .*＼.(gif|jpg|jpeg|png|bmp|swf)$ {

expires 15d;

}

location ~ .*＼.(js|css)?$ {

expires 1d;

}

}

}

```

  
  
  

# 访问限制

  
  

```plain

#限制用户连接数来预防DOS攻击

limit_conn_zone $binary_remote_addr zone=perip:10m;

limit_conn_zone $server_name zone=perserver:10m;

#限制同一客户端ip最大并发连接数

limit_conn perip 2;

#限制同一server最大并发连接数

limit_conn perserver 20;

#限制下载速度，根据自身服务器带宽配置

limit_rate 300k;

```

  
  
  

# 高效数据传输配置

  
  

```plain

#开启文件的高效传输模式。tcp_nopush和tcp_nodelay可防止网络及磁盘i/o阻塞，提升nginx工作效率;

sendfile on;

#数据包不会马上传送出去，等到数据包最大时，一次性的传输出去，这样有助于解决网络堵塞。

tcp_nopush on;

#只要有数据包产生，不管大小多少，就尽快传输

tcp_nodelay on;

```

  
  
  

# 负载均衡配置

  
  

```plain

http {

# 定义集群

upstream demo {

server localhost:1111;

server localhost:1112;

server localhost:1113;

server localhost:1114;

server localhost:1115;

}

server {

location / {

proxy_pass http://demo

}

}

}

```

  
  
  

# 配置 请求的Referer

  
  

```plain

map $http_referer $ref {

default $http_referer;

~(http:\/\/hello)(.*) $1abc$2;

~http://why http://hello;

}

```

  
  
  

在需要的location块中添加

  
  
  

```plain

proxy_set_header referer $ref;

```

  
  
  

效果

  
  
  

> 原referer = [http://why的referer](http://xn--whyreferer-kk5y) 就会改成 [http://hello](http://hello)

原referer = [http://hello/world](http://hello/world) 会改成[http://helloabc/world](http://helloabc/world)

>

  
  
  

# Nginx启动失败 invalid PID number

  
  

指定nginx配置文件即可

  
  
  

> nginx -c /etc/nginx/nginx.conf

>

  
  
  

linux 查看进程pid

  
  
  

> ps -ef|grep +  名称

>

  
  
  

linux 杀死进程

  
  
  

> kill -9 + pid

>

  
  
  

# 301永久性转移

  
  

```plain

server {

listen 80;

server_name domain.com;

return 301 https://$server_name$server_port$request_uri;

}

```

  

# 配置SSL证书

```shell

server {

#HTTPS的默认访问端口443。

#如果未在此处配置HTTPS的默认访问端口，可能会造成Nginx无法启动。

listen 443 ssl;

#填写证书绑定的域名

server_name <yourdomain>;

#填写证书文件绝对路径

ssl_certificate cert/<cert-file-name>.pem;

#填写证书私钥文件绝对路径

ssl_certificate_key cert/<cert-file-name>.key;

ssl_session_cache shared:SSL:1m;

ssl_session_timeout 5m;

#自定义设置使用的TLS协议的类型以及加密套件（以下为配置示例，请您自行评估是否需要配置）

#TLS协议版本越高，HTTPS通信的安全性越高，但是相较于低版本TLS协议，高版本TLS协议对浏览器的兼容性较差。

ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;

ssl_protocols TLSv1.1 TLSv1.2 TLSv1.3;

  

#表示优先使用服务端加密套件。默认开启

ssl_prefer_server_ciphers on;

location / {

root html;

index index.html index.htm;

}

}

```

  

http跳转到https

  

```shell

server {

listen 80;

#填写证书绑定的域名

server_name <yourdomain>;

#将所有HTTP请求通过rewrite指令重定向到HTTPS。

rewrite ^(.*)$ https://$host$1;

location / {

index index.html index.htm;

}

}

```

  

# 转pem证书

crt转pem证书

  

```shell

openssl x509 -in tmp.crt -out tmp.pem

```

  

key转pem证书

  

```shell

openssl rsa -in temp.key -out temp.pem

```