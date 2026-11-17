package com.aet.portfolio.controller;

import com.aet.portfolio.config.SiteProperties;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@EnableConfigurationProperties(SiteProperties.class)
public class ClassroomController {
    private final SiteProperties classroom;

    public ClassroomController(SiteProperties classroom) {
        this.classroom = classroom;
    }

    @GetMapping("/api/site/classroom")
    public ClassroomResponse classroom() {
        var data = classroom.classroom();
        return new ClassroomResponse(data.whiteboardLines(), data.tvSlides(), data.teacherLines(),
            data.board(), data.mission(), data.vision(), classroom.theme(), classroom.audio(), classroom.intro());
    }

    // Missing optional artwork is a successful empty response, avoiding browser 404 noise.
    @GetMapping("/assets/textures/window-sunset.jpg")
    public ResponseEntity<Resource> windowSunset() {
        Resource photo = new ClassPathResource("static/assets/textures/window-sunset.jpg");
        return photo.exists()
            ? ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(photo)
            : ResponseEntity.noContent().build();
    }

    public record ClassroomResponse(java.util.List<String> whiteboardLines, java.util.List<String> tvSlides,
        java.util.List<String> teacherLines, SiteProperties.Board board, SiteProperties.Placard mission,
        SiteProperties.Placard vision, SiteProperties.Theme theme, SiteProperties.Audio audio, SiteProperties.Intro intro) {}
}
