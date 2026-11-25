import com.fastcgi.FCGIInterface;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

public class Main {
    private static final List<String> history = new ArrayList<>();
    private static final Path FILE = Path.of("/home/studs/s502630/httpd-root/history.jsonl");
    private static final String EPOCH = Long.toString(System.currentTimeMillis());
    private static final int LIMIT = 128;

    public static void main(String[] args) throws Exception {
        FCGIInterface fcgi = new FCGIInterface();
        loadHistory();
        Files.createDirectories(FILE.getParent());

        while (fcgi.FCGIaccept() >= 0) {
            try {
                long start = System.nanoTime();

                String query = FCGIInterface.request.params.getProperty("QUERY_STRING");
                Map<String, String> map = parseQuery(query);
                if ("history".equals(map.get("action"))) {
                    String etag = etag();
                    String inm = FCGIInterface.request.params.getProperty("HTTP_IF_NONE_MATCH");
                    if (etag.equals(inm)) {
                        send(304, "Not Modified", "no-cache", etag, null);  // 304, без тела
                    } else {
                        send(200, "OK", "no-cache", etag, snapshot());         // 200 + ETag + no-cache
                    }
                    continue;
                }
                int x = Integer.parseInt(map.get("x"));
                double y = Double.parseDouble(map.get("y").replace(",", "."));
                double r = Double.parseDouble(map.get("r").replace(",", "."));
                if (!List.of(-4, -3, -2, -1, 0, 1, 2, 3, 4).contains(x) || !(-5 < y && y < 3) || !(1 < r && r < 4)) {
                    throw new Exception("Out of Range");
                }

                boolean hit = false;
                if (x > 0 && y >= 0) {
                    hit = x * x + y * y <= (r / 2) * (r / 2);
                } else if (x <= 0 && y > 0) {
                    hit = y <= 2 * x + r;
                } else if (x <= 0 && y <= 0) {
                    hit = x >= -r && y >= -r;
                }
                long end = System.nanoTime();
                long duration = end - start;
                long time = System.currentTimeMillis();


                String record = "{\"x\": " + x +
                        ", \"y\": " + y +
                        ", \"r\": " + r +
                        ", \"hit\": " + hit +
                        ", \"time\": " + time +
                        ", \"duration\": " + duration +
                        "}";               // JSON с результатами
                persist(record);
                history.add(record);
                long v = history.size();
                String body = "{\"epoch\":\"" + EPOCH
                        + "\",\"base\":" + (v - 1)
                        + ",\"version\":" + v
                        + ",\"record\":" + record + "}";
                send(200, "OK", "no-store", null, body);
            } catch (IOException e) {
                send(500, "Internal Server Error", "no-store", null, "{\"error\":\"Ошибка записи\"}");
            } catch (Exception e) {
                send(400, "Bad Request", "no-store", null, "{\"error\":\"Неправильные параметры запроса\"}");
            }
        }
    }

    private static String etag() {
        return "\"" + EPOCH + "-" + history.size() + "\"";
    }

    private static String snapshot() {
        int from = Math.max(0, history.size() - LIMIT);
        return "{\"epoch\":\"" + EPOCH
                + "\",\"version\":" + history.size()
                + ",\"records\":[" + String.join(",", history.subList(from, history.size()))
                + "]}";
    }

    private static void send(int code, String text, String cache, String etag, String body) {
        StringBuilder head = new StringBuilder("HTTP/1.1 " + code + " " + text + "\r\n");
        head.append("Cache-Control: ").append(cache).append("\r\n");
        if (etag != null) head.append("ETag: ").append(etag).append("\r\n");
        byte[] bytes = null;
        if (body != null) {
            bytes = body.getBytes(StandardCharsets.UTF_8);
            head.append("Content-Type: application/json; charset=utf-8\r\n")
                    .append("Content-Length: ").append(bytes.length).append("\r\n");
        }
        head.append("\r\n");
        System.out.print(head);
        if (bytes != null) System.out.write(bytes, 0, bytes.length);
        System.out.flush();
    }

    private static Map<String, String> parseQuery(String query) {
        Map<String, String> map = new HashMap<>();
        if (query == null || query.isEmpty()) return map;
        for (String pair : query.split("&")) {
            if (pair.isEmpty()) continue;
            String[] kv = pair.split("=", 2);
            String key = URLDecoder.decode(kv[0], StandardCharsets.UTF_8);
            String value = kv.length > 1 ? URLDecoder.decode(kv[1], StandardCharsets.UTF_8) : "";
            map.put(key, value);
        }
        return map;
    }

    private static void loadHistory() {
        if (!Files.exists(FILE)) return;
        try {
            for (String line : Files.readAllLines(FILE, StandardCharsets.UTF_8)) {
                if (line.startsWith("{") && line.endsWith("}")) history.add(line);
            }
        } catch (IOException e) {
            System.err.println("Не удалось прочитать историю: " + e);
        }
    }

    private static void persist(String line) throws IOException {
        Files.writeString(FILE, line + "\n", StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    }
}