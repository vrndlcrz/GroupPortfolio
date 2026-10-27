package com.aet.portfolio.controller;

import com.aet.portfolio.service.CounterService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class VisitController {

    private final CounterService counterService;

    public VisitController(CounterService counterService) {
        this.counterService = counterService;
    }

    @PostMapping("/api/visit")
    public ResponseEntity<Map<String, Object>> recordVisit() {
        int newCount = counterService.incrementAndGet();
        String joke = counterService.getVisitorJoke(newCount);
        return ResponseEntity.ok(Map.of(
                "count", newCount,
                "message", joke
        ));
    }

    @GetMapping("/api/visit")
    public ResponseEntity<Map<String, Object>> getVisit() {
        int currentCount = counterService.getCount();
        String joke = counterService.getVisitorJoke(currentCount);
        return ResponseEntity.ok(Map.of(
                "count", currentCount,
                "message", joke
        ));
    }
}
