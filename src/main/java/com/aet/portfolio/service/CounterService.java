package com.aet.portfolio.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.aet.portfolio.storage.JsonFileStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Service
public class CounterService {

    private static final Logger logger = LoggerFactory.getLogger(CounterService.class);
    private static final String COUNTER_FILE = "counter.json";
    private final ObjectMapper objectMapper;
    private final JsonFileStore store;
    private final Object fileLock = new Object();
    private int count = 0;

    public CounterService(ObjectMapper objectMapper, JsonFileStore store) {
        this.objectMapper = objectMapper;
        this.store = store;
    }

    @PostConstruct
    public void init() {
        synchronized (fileLock) {
            File file = store.file(COUNTER_FILE).toFile();
            if (!file.exists()) {
                count = 0;
                persistCount(0);
                logger.info("Initialized counter.json with count=0 at {}", file.getAbsolutePath());
            } else {
                try {
                    Map<String, Object> data = objectMapper.readValue(file, new TypeReference<Map<String, Object>>() {});
                    if (data != null && data.containsKey("count")) {
                        count = ((Number) data.get("count")).intValue();
                    }
                    logger.info("Loaded visitor count: {}", count);
                } catch (IOException e) {
                    logger.error("Could not read counter.json, starting with count=0", e);
                    count = 0;
                }
            }
        }
    }

    public int getCount() {
        synchronized (fileLock) {
            return count;
        }
    }

    public int incrementAndGet() {
        synchronized (fileLock) {
            int nextCount = Math.addExact(count, 1);
            persistCount(nextCount);
            count = nextCount;
            return count;
        }
    }

    private void persistCount(int value) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("count", value);
            store.write(COUNTER_FILE, data);
        } catch (IOException e) {
            logger.error("Failed to write to counter.json", e);
            throw new IllegalStateException("Could not persist visitor count", e);
        }
    }

    public String getVisitorJoke(int currentCount) {
        return "You are visitor #" + currentCount + ". Please go touch grass.";
    }
}
