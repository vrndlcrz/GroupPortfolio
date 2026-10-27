package com.aet.portfolio.service;

import com.fasterxml.jackson.core.type.TypeReference;
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
    private final Object fileLock = new Object();
    private int count = 0;

    public CounterService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        synchronized (fileLock) {
            File file = new File(COUNTER_FILE);
            if (!file.exists()) {
                count = 0;
                persistCount();
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
            count++;
            persistCount();
            return count;
        }
    }

    private void persistCount() {
        try {
            File file = new File(COUNTER_FILE);
            Map<String, Object> data = new HashMap<>();
            data.put("count", count);
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(file, data);
        } catch (IOException e) {
            logger.error("Failed to write to counter.json", e);
        }
    }

    public String getVisitorJoke(int currentCount) {
        return "You are visitor #" + currentCount + ". Please go touch grass.";
    }
}
