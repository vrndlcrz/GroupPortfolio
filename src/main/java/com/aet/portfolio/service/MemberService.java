package com.aet.portfolio.service;

import com.aet.portfolio.model.Member;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
public class MemberService {

    private static final Logger logger = LoggerFactory.getLogger(MemberService.class);
    private final ObjectMapper objectMapper;
    private final List<Member> members = new ArrayList<>();

    public MemberService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        loadMembers();
    }

    public synchronized void loadMembers() {
        try {
            ClassPathResource resource = new ClassPathResource("data/members.json");
            try (InputStream inputStream = resource.getInputStream()) {
                List<Member> loaded = objectMapper.readValue(inputStream, new TypeReference<List<Member>>() {});
                members.clear();
                if (loaded != null) {
                    members.addAll(loaded);
                }
                logger.info("Successfully loaded {} members from members.json", members.size());
            }
        } catch (Exception e) {
            logger.error("Failed to load members.json", e);
        }
    }

    public List<Member> getAllMembers() {
        return Collections.unmodifiableList(members);
    }

    public Optional<Member> getMemberById(int id) {
        return members.stream()
                .filter(m -> m.getId() == id)
                .findFirst();
    }
}
