package com.aet.portfolio.config;

import java.util.List;
import jakarta.validation.Valid;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.core.io.ClassPathResource;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("site")
public record SiteProperties(@Valid Classroom classroom, @Valid @DefaultValue Theme theme,
                             @Valid @DefaultValue Audio audio, @Valid @DefaultValue Intro intro,
                             List<@Valid Student> students, @Valid @DefaultValue Phone phone) {
    @Validated
    public record Phone(List<@Valid Track> tracks, List<@Valid PhoneVideo> videos) {
        public Phone {
            tracks = tracks == null ? List.of() : List.copyOf(tracks);
            videos = videos == null ? List.of() : List.copyOf(videos);
        }
    }
    public record Track(@NotBlank String id, @NotBlank String title,
                        @Pattern(regexp="^/assets/audio/[a-zA-Z0-9_-]+[.](mp3|ogg|m4a|wav)$") String audio,
                        @Pattern(regexp="^/assets/videos/[a-zA-Z0-9_-]+[.](mp4|webm)$") String video) {
        @JsonProperty("audioAvailable") public boolean audioAvailable() { return exists(audio); }
        @JsonProperty("videoAvailable") public boolean videoAvailable() { return exists(video); }
        private static boolean exists(String path) {
            return path != null && new ClassPathResource("static" + path).exists();
        }
    }
    public record PhoneVideo(@NotBlank String id, @NotBlank String title, @NotBlank String member,
        @NotBlank @Pattern(regexp="^/assets/videos/(?!.*\\.\\.)[^?#\\\\]+$") String src,
        @Pattern(regexp="^/assets/videos/(?!.*\\.\\.)[^?#\\\\]+$") String poster) {
        // Avoid requesting absent files: browsers log a network error before media.onerror.
        @JsonProperty("available") public boolean available() {
            return src != null && new ClassPathResource("static" + src).exists();
        }
        @JsonProperty("posterAvailable") public boolean posterAvailable() {
            return poster != null && new ClassPathResource("static" + poster).exists();
        }
    }

    public record Look(String skin, String hairStyle, String hairColor, String outfitColor, String accessory) {}
    public record Student(@NotBlank String id, @NotBlank String name, String line,
                          @Min(1) @Max(4) int row, @Min(1) @Max(4) int col,
                          boolean dance, @Valid Look look) {}

    @AssertTrue(message = "Named student seats must be unique and stay in rows 1-3; row 4 is reserved for the viewer, absent seat, and extras")
    public boolean isStudentSeatingValid() {
        if (students == null) return true;
        var seats = new java.util.HashSet<Integer>();
        for (var student : students) {
            if (student.row() == 4 ||
                !seats.add(student.row() * 4 + student.col())) return false;
        }
        return true;
    }
    @Validated
    public record Intro(@DefaultValue("true") boolean enabled,
                        @DefaultValue("What if Sir Sean was your highschool teacher?") @NotBlank String title,
                        @DefaultValue("A Group 1 production") String subtitle,
                        @DefaultValue("true") boolean soundEnabled) {}
    public record Audio(@DefaultValue("/assets/audio/notebook-theme.mp3") String notebookTheme) {
        @JsonProperty("kimEntry") public String kimEntry() { return cue("kim-entry.mp3"); }
        @JsonProperty("jeoEntry") public String jeoEntry() { return cue("jeo-entry.mp3"); }
        @JsonProperty("rinEntry") public String rinEntry() { return cue("rin-entry.mp3"); }
        private static String cue(String name) {
            String path = "/assets/audio/" + name;
            return new ClassPathResource("static" + path).exists() ? path : null;
        }
    }
    public record Classroom(List<String> whiteboardLines, List<String> tvSlides, List<String> teacherLines,
                            Board board, Placard mission, Placard vision,
                            @DefaultValue("Mara Dimaculangan") @NotBlank String absentName) {}
    public record Theme(@DefaultValue("0.8") @DecimalMin("0.0") @DecimalMax("1.0") double goldenIntensity,
                        @DefaultValue("true") boolean skyDrift) {}
    public record Board(String title, String subtitle, List<String> names) {}
    public record Placard(String title, String text) {}
}
