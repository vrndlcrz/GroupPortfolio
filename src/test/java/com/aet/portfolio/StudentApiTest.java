package com.aet.portfolio;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class StudentApiTest {
    @Autowired MockMvc mvc;
    @Test void classroomIncludesConfiguredStudents() throws Exception {
        mvc.perform(get("/api/site/classroom"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.classroom.absentName").value("Mara Dimaculangan"))
            .andExpect(jsonPath("$.students.length()").value(8))
            .andExpect(jsonPath("$.students[0].name").value("Dinorobong Tubo"))
            .andExpect(jsonPath("$.students[1].name").value("Diwata Pares"))
            .andExpect(jsonPath("$.students[2].name").value("Bea Borres"))
            .andExpect(jsonPath("$.students[3].name").value("Lans"))
            .andExpect(jsonPath("$.students[4].name").value("Buseng"))
            .andExpect(jsonPath("$.students[5].name").value("Mosh"))
            .andExpect(jsonPath("$.students[6].name").value("Iannah"))
            .andExpect(jsonPath("$.students[7].name").value("Sherwin"))
            .andExpect(jsonPath("$.students[0].dance").value(true))
            .andExpect(jsonPath("$.students[2].line").value("My baby daddy Meray, Hopea, I'm dinadaan-daanan lang"));
    }
}
