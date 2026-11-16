package com.aet.portfolio;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class MemberControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void testGetAllMembers() throws Exception {
        mockMvc.perform(get("/api/members").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[*].name", contains("Riam Jaye Santiago", "John Vernie Dela Cruz", "Charella Magalpoc", "Nicole De Guzman")))
                .andExpect(jsonPath("$[*].deskItem", contains("spiral-notebook", "long-folder", "theme-book", "intermediate-pad")))
                .andExpect(jsonPath("$[0].themeSong.provider", is("file")))
                .andExpect(jsonPath("$[0].themeSong.src", is("assets/audio/notebook-theme.mp3")))
                .andExpect(jsonPath("$[0].themeSong.title", is("Notebook theme")))
                .andExpect(jsonPath("$[0].themeSong.credit", is("")))
                .andExpect(jsonPath("$[1].themeSong").doesNotHaveJsonPath())
                .andExpect(jsonPath("$[0].coverColor", is("#FF7A00")))
                .andExpect(jsonPath("$[0].pages", hasSize(6)))
                .andExpect(jsonPath("$[0].skills", not(empty())));
    }

    @Test
    public void testGetMemberById() throws Exception {
        mockMvc.perform(get("/api/members/1").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id", is(1)))
                .andExpect(jsonPath("$.name", is("Riam Jaye Santiago")))
                .andExpect(jsonPath("$.tagline", containsString("Emerging")))
                .andExpect(jsonPath("$.pages[0].title", is("About Me")))
                .andExpect(jsonPath("$.pages[0].border", is("wavy-pink.svg")));
    }

    @Test
    public void testGetMemberNotFound() throws Exception {
        mockMvc.perform(get("/api/members/999").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }
}
