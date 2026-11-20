package com.aet.portfolio;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "site.classroom.teacherLines[0]=Test classroom announcement")
@AutoConfigureMockMvc
class ClassroomControllerTest {
    @Autowired MockMvc mvc;

    @Test
    void optionalWindowPhotoNeverReturnsAnError() throws Exception {
        mvc.perform(get("/assets/textures/window-sunset.jpg"))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void servesConfiguredClassroom() throws Exception {
        mvc.perform(get("/api/site/classroom"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.intro.enabled").value(true))
            .andExpect(jsonPath("$.intro.title").value("What if Sir Sean was your highschool teacher?"))
            .andExpect(jsonPath("$.intro.subtitle").value("A Group 1 production"))
            .andExpect(jsonPath("$.intro.soundEnabled").value(true))
            .andExpect(jsonPath("$.audio.notebookTheme").value("/assets/audio/notebook-theme.mp3"))
            .andExpect(jsonPath("$.theme.goldenIntensity").value(0.8))
            .andExpect(jsonPath("$.theme.skyDrift").value(true))
            .andExpect(jsonPath("$.theme.filterEnabled").doesNotExist())
            .andExpect(jsonPath("$.theme.filterIntensity").doesNotExist())
            .andExpect(jsonPath("$.theme.dateStamp").doesNotExist())
            .andExpect(jsonPath("$.board.title").value("Sean Dyogi Truthers"))
            .andExpect(jsonPath("$.whiteboardLines[0]").value("AET Group Portfolio"))
            .andExpect(jsonPath("$.tvSlides", hasSize(3)))
            .andExpect(jsonPath("$.tvSlides[2]").value("Click the laptop"))
            .andExpect(jsonPath("$.teacherLines[0]").value("Test classroom announcement"));
    }
}
