package com.aet.portfolio.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("site.classroom")
public record SiteProperties(List<String> whiteboardLines, List<String> tvSlides, List<String> teacherLines,
                             Board board, Placard mission, Placard vision) {
    public record Board(String title, String subtitle, List<String> names) {}
    public record Placard(String title, String text) {}
}
