package com.aet.portfolio;

import com.aet.portfolio.config.SiteProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.validation.ValidationAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes=PortfolioApplication.class)
@AutoConfigureMockMvc
class PhoneConfigurationTest {
    @Autowired MockMvc mvc;
    final ApplicationContextRunner binding = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(ValidationAutoConfiguration.class))
        .withUserConfiguration(Binding.class);
    @TestConfiguration(proxyBeanMethods=false)
    @EnableConfigurationProperties(SiteProperties.class)
    static class Binding {}

    @Test void classroomIncludesPhoneWithoutChangingItsExistingFields() throws Exception {
        mvc.perform(get("/api/site/classroom")).andExpect(status().isOk())
            .andExpect(jsonPath("$.phone.tracks.length()").value(7))
            .andExpect(jsonPath("$.phone.tracks[0].title").value("Hev Abi - Preso"))
            .andExpect(jsonPath("$.phone.tracks[6].id").value("tma"))
            .andExpect(jsonPath("$.phone.videos").isArray())
            .andExpect(jsonPath("$.phone.videos").isEmpty())
            .andExpect(jsonPath("$.board.title").exists());
    }
    @Test void tracksRequireLocalMediaPaths() {
        var track = binding.withPropertyValues("site.phone.tracks[0].id=example",
            "site.phone.tracks[0].title=Example");
        track.withPropertyValues("site.phone.tracks[0].audio=https://example.com/audio.mp3")
            .run(context -> assertThat(context).hasFailed());
        track.withPropertyValues("site.phone.tracks[0].audio=/assets/audio/example.mp3")
            .run(context -> assertThat(context).hasNotFailed());
    }

    @Test void onlyLocalGroupVideoPathsBind() {
        var video = binding.withPropertyValues("site.phone.videos[0].id=v1",
            "site.phone.videos[0].title=Our clip", "site.phone.videos[0].member=Member");
        video.withPropertyValues("site.phone.videos[0].src=/assets/elsewhere.mp4")
            .run(context -> assertThat(context).hasFailed());
        video.withPropertyValues("site.phone.videos[0].src=/assets/videos/ours.mp4",
            "site.phone.videos[0].poster=/external/poster.png")
            .run(context -> assertThat(context).hasFailed());
        video.withPropertyValues("site.phone.videos[0].src=/assets/videos/ours.mp4")
            .run(context -> {
                assertThat(context).hasNotFailed();
                var entry = context.getBean(SiteProperties.class).phone().videos().get(0);
                assertThat(entry.available()).isFalse();
                assertThat(entry.posterAvailable()).isFalse();
            });
    }
}
