package com.aet.portfolio;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class NoteAndCounterControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void testPostAndGetNote() throws Exception {
        String payload = "{\"text\":\"Great portfolio presentation!\",\"author\":\"Student Reviewer\"}";

        mockMvc.perform(post("/api/members/1/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.memberId", is(1)))
                .andExpect(jsonPath("$.text", is("Great portfolio presentation!")))
                .andExpect(jsonPath("$.author", is("Student Reviewer")));

        mockMvc.perform(get("/api/members/1/notes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", not(empty())))
                .andExpect(jsonPath("$[-1].text", is("Great portfolio presentation!")));
    }

    @Test
    public void testRejectEmptyNote() throws Exception {
        String emptyPayload = "{\"text\":\"   \",\"author\":\"Tester\"}";

        mockMvc.perform(post("/api/members/1/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(emptyPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("empty")));
    }

    @Test
    public void testRejectTooLongNote() throws Exception {
        String longText = "A".repeat(125);
        String payload = "{\"text\":\"" + longText + "\",\"author\":\"Tester\"}";

        mockMvc.perform(post("/api/members/1/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("exceeds")));
    }

    @Test
    public void testHtmlEscapingInNote() throws Exception {
        String payload = "{\"text\":\"<script>alert('pwned')</script> & <b>bold</b>\",\"author\":\"<hacker>\"}";

        mockMvc.perform(post("/api/members/2/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.text", not(containsString("<script>"))))
                .andExpect(jsonPath("$.text", containsString("&lt;script&gt;")))
                .andExpect(jsonPath("$.author", containsString("&lt;hacker&gt;")));
    }

    @Test
    public void testPostNoteToNonExistentMember() throws Exception {
        String payload = "{\"text\":\"Hello\",\"author\":\"Nobody\"}";

        mockMvc.perform(post("/api/members/999/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isNotFound());
    }

    @Test
    public void testVisitCounter() throws Exception {
        mockMvc.perform(post("/api/visit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.message", containsString("Please go touch grass.")));
    }
}
