#!/bin/sh
# Запускается НА ГЕЛИОСЕ (делает make через ssh): перезапускает Java-приложение и применяет конфиг Apache.
 
# В неинтерактивной ssh-сессии PATH бывает урезан: java и httpd могут не находиться
PATH="$PATH:/usr/local/bin:/usr/local/sbin"
export PATH
 
# Те же ограничения памяти, что и в вашей интерактивной сессии
_JAVA_OPTIONS="-XX:MaxHeapSize=1G -XX:MaxMetaspaceSize=128m"
export _JAVA_OPTIONS
 
ROOT="$HOME/httpd-root"
JAR="$ROOT/fcgi-bin/Lab2-1.0.jar"
CONF="$ROOT/httpd.conf"
FCGI_PORT=25757      # должен совпадать с -host localhost:... в httpd.conf
 
# Режим остановки: sh restart.sh stop (вызывается через make stop)
if [ "$1" = "stop" ]; then
    pkill -u "$(id -un)" -f "$JAR"
    httpd -f "$CONF" -k stop
    sleep 2
    if pgrep -u "$(id -un)" -f "$JAR" > /dev/null; then
        echo "Java всё ещё работает" >&2
    else
        echo "Java остановлена"
    fi
    if pgrep -u "$(id -un)" -x httpd > /dev/null; then
        echo "Apache ещё завершается (проверьте через пару секунд: pgrep -l httpd)" >&2
    else
        echo "Apache остановлен"
    fi
    exit 0
fi
 
# 1. Остановить старый процесс (если он есть)
pkill -u "$(id -un)" -f "$JAR"
sleep 1
 
# 2. Подменить jar на только что загруженный (старый уже не запущен)
if [ -f "$JAR.new" ]; then
    mv -f "$JAR.new" "$JAR"
fi
 
# 3. Запустить Java в фоне; лог в httpd-root/java.log
cd "$HOME" || exit 1
nohup java -DFCGI_PORT="$FCGI_PORT" -jar "$JAR" > "$ROOT/java.log" 2>&1 < /dev/null &
 
# 4. Apache: проверить конфиг; применить, а если не запущен, то запустить
if httpd -f "$CONF" -t; then
    httpd -f "$CONF" -k graceful || httpd -f "$CONF" -k start
else
    echo "Ошибка в httpd.conf, Apache не перезапущен" >&2
    exit 1
fi
 
sleep 2
if pgrep -u "$(id -un)" -f "$JAR" > /dev/null; then
    echo "Java запущена"
else
    echo "Java не запустилась, смотрите $ROOT/java.log" >&2
    exit 1
fi
 
