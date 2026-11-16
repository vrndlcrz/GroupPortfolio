package com.aet.portfolio.controller;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class NotebookAudioController {
    @GetMapping("/assets/audio/notebook-theme.mp3")
    public ResponseEntity<Resource> notebookTheme() {
        Resource track = new ClassPathResource("static/assets/audio/notebook-theme.mp3");
        if (!track.exists()) {
            // An optional local track can be absent without generating a browser HTTP error.
            return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
        }
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("audio/mpeg")).body(track);
    }
}
