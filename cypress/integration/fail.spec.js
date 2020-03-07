/// <reference types="cypress" />

describe("Example Tests", () => {
  it("issues", () => {
    cy.visit("https://lms.curtin.edu.au");
    cy.wrap("hello").should("have.length", 1);
  });

  it("test fail", () => {
    cy.visit("https://greglahaye.github.io/test-website/");
    cy.wrap("hello").should("have.length", 1);
  });

  it("no network", () => {
    cy.wrap("hello").should("have.length", 1);
  });
});
