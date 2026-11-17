package com.aet.portfolio.config;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("site")
public record SiteProperties(@Valid Classroom classroom, @Valid @DefaultValue Theme theme,
                             @Valid @DefaultValue Audio audio, @Valid @DefaultValue Intro intro) {
    @Validated
    public record Intro(@DefaultValue("true") boolean enabled,
                        @DefaultValue("What if Sir Sean was a highschool teacher?") @NotBlank String title,
                        @DefaultValue("A Group 1 production") String subtitle,
                        @DefaultValue("true") boolean soundEnabled) {}
    public record Audio(@DefaultValue("/assets/audio/notebook-theme.mp3") String notebookTheme) {}
    public record Classroom(List<String> whiteboardLines, List<String> tvSlides, List<String> teacherLines,
                            Board board, Placard mission, Placard vision) {}
    public record Theme(@DefaultValue("0.8") @DecimalMin("0.0") @DecimalMax("1.0") double goldenIntensity,
                        @DefaultValue("true") boolean skyDrift) {}
    public record Board(String title, String subtitle, List<String> names) {}
    public record Placard(String title, String text) {}
}
