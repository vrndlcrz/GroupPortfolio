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
class MemberProfileFieldsTest {
    @Autowired MockMvc mvc;
    @Test void optionalJohnProfileFieldsAreExposedWithoutChangingOtherMembers() throws Exception {
        mvc.perform(get("/api/members/2")).andExpect(status().isOk())
            .andExpect(jsonPath("$.titleText").value("John Vernie"))
            .andExpect(jsonPath("$.ageLine").value("TODO years of existence"))
            .andExpect(jsonPath("$.objective").value("TODO"));
        mvc.perform(get("/api/members")).andExpect(status().isOk())
            .andExpect(jsonPath("$[1].titleText").value("John Vernie"))
            .andExpect(jsonPath("$[1].ageLine").value("TODO years of existence"))
            .andExpect(jsonPath("$[1].objective").value("TODO"))
            .andExpect(jsonPath("$[0].titleText").doesNotExist());
    }
}
